"""Mind map and knowledge graph generation service using Gemini, Neo4j, and Supabase."""
import json
import logging
import re
from collections import defaultdict
from supabase_client import sb_select, sb_insert, sb_update, sb_delete
from services.rate_limiter import gemini_rate_limiter

logger = logging.getLogger(__name__)

# Gemini Model Configuration
GEMINI_MODEL = "gemini-2.5-flash"
GEMINI_FALLBACK = "gemini-2.5-flash-lite"

def call_gemini(model_obj, prompt, generation_config=None):
    """Call Gemini with fallback logic."""
    import google.generativeai as genai
    gemini_rate_limiter.wait()
    try:
        return model_obj.generate_content(prompt, generation_config=generation_config)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Primary model {GEMINI_MODEL} failed, trying fallback {GEMINI_FALLBACK}: {e}")
        fallback_model = genai.GenerativeModel(GEMINI_FALLBACK)
        return fallback_model.generate_content(prompt, generation_config=generation_config)


def generate_mind_map(topic: str, documents: list = None, depth: int = 3) -> dict:
    """Generate a mind map from a topic, optionally enriched with document content."""
    
    # If we have documents, extract key concepts for richer maps
    concepts = []
    if documents:
        for doc in documents:
            content = doc.get('content', doc.get('content_text', ''))
            if content:
                # Extract key phrases (simple keyword extraction)
                words = re.findall(r'\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b', content)
                concepts.extend(set(words[:20]))
    
    # Try Gemini for intelligent map
    try:
        import google.generativeai as genai
        import os
        from flask import current_app
        
        api_key = current_app.config.get('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            prompt = f"""You are an expert educator creating a comprehensive knowledge mind map.

Topic: "{topic}"

Return a JSON object with this EXACT structure (valid JSON only, no explanation):
{{
  "id": "root",
  "label": "{topic}",
  "children": [
    {{
      "id": "branch_1",
      "label": "Category Name",
      "color": "#3b82f6",
      "children": [
        {{
          "id": "sub_1_1",
          "label": "Sub-Topic",
          "children": [
            {{"id": "detail_1_1_1", "label": "Specific Detail", "children": []}}
          ]
        }}
      ]
    }}
  ]
}}

Rules:
- Create 6-8 main branches covering ALL aspects of the topic
- Each branch should have 4-6 sub-topics
- Each sub-topic should have 2-4 leaf details when possible
- Make it {depth} levels deep minimum
- Use specific, domain-accurate terminology (not generic)
- Use these colors for branches: "#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#ef4444", "#a855f7"
- Include formulas, algorithms, key terms, real-world applications
- If a concept has a formula, include it in the label (e.g. "Time Complexity: O(n log n)")
{("- Use these concepts extracted from user's private documents for enrichment: " + "; ".join(concepts[:20])) if concepts else "- Use general knowledge from authoritative sources"}
"""
            
            response = call_gemini(model, prompt, generation_config={"response_mime_type": "application/json"})
            content = response.text
            # Parse JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Gemini mind map generation failed: {e}")
    
    # Fallback: generate a structured mock mind map
    return _generate_mock_mind_map(topic, concepts)


def _generate_mock_mind_map(topic: str, concepts: list = None) -> dict:
    """Generate a structured mock mind map."""
    branches = {
        'Fundamentals': ['Core Concepts', 'Key Principles', 'Definitions', 'History'],
        'Methods': ['Techniques', 'Approaches', 'Best Practices', 'Tools'],
        'Applications': ['Real World Use', 'Case Studies', 'Industry Examples', 'Projects'],
        'Advanced Topics': ['Deep Dive', 'Research', 'Innovations', 'Trends'],
        'Resources': ['Books', 'Courses', 'Communities', 'Documentation'],
    }
    
    colors = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899']
    
    children = []
    for i, (branch_name, leaves) in enumerate(branches.items()):
        branch_children = []
        for j, leaf in enumerate(leaves):
            leaf_node = {
                'id': f'leaf_{i}_{j}',
                'label': leaf if not concepts else (concepts.pop(0) if concepts else leaf),
                'children': [],
            }
            branch_children.append(leaf_node)
        
        children.append({
            'id': f'branch_{i}',
            'label': branch_name,
            'color': colors[i % len(colors)],
            'children': branch_children,
        })
    
    return {
        'id': 'root',
        'label': topic,
        'children': children,
    }


def generate_knowledge_graph(user_id: int, documents: list) -> dict:
    """Generate a knowledge graph from user's documents using Gemini to extract and Neo4j to store."""
    from flask import current_app
    import google.generativeai as genai
    
    uri = current_app.config.get('NEO4J_URI')
    user = current_app.config.get('NEO4J_USERNAME')
    password = current_app.config.get('NEO4J_PASSWORD')
    api_key = current_app.config.get('GEMINI_API_KEY')
    
    if not all([api_key]):
        return _generate_mock_knowledge_graph(documents)
    
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        combined_content = ""
        for i, doc in enumerate(documents):
            content = doc.get('content', doc.get('content_text', ''))
            combined_content += f"Document {doc.get('id', i)}: {doc.get('title', 'Unknown')}\n{content[:1500]}\n\n"
            
        prompt = f"""Extract a knowledge graph from these documents.
Identify key topics/concepts and their relationships.
Return ONLY valid JSON in this structure:
{{
    "nodes": [ {{"id": "doc_1", "label": "Title", "type": "document"}}, {{"id": "concept_1", "label": "Concept", "type": "concept"}} ],
    "edges": [ {{"source": "doc_1", "target": "concept_1", "label": "mentions"}} ]
}}
Ensure document nodes have 'type': 'document' and concepts have 'type': 'concept'.
Content:
{combined_content}
"""
        response = call_gemini(model, prompt, generation_config={"response_mime_type": "application/json", "temperature": 0.2})
        graph_data = json.loads(response.text)
        
        # Insert into Neo4j
        if uri and user and password:
            try:
                from neo4j import GraphDatabase
                with GraphDatabase.driver(uri, auth=(user, password)) as driver:
                    with driver.session() as session:
                        session.run("MATCH (n) WHERE n.user_id = $uid DETACH DELETE n", uid=str(user_id))
                        for node in graph_data.get('nodes', []):
                            session.run(
                                "MERGE (n:Node {id: $id, user_id: $uid}) SET n.label = $label, n.type = $type",
                                id=node['id'], uid=str(user_id), label=node.get('label',''), type=node.get('type', 'concept')
                            )
                        for edge in graph_data.get('edges', []):
                            session.run(
                                "MATCH (a:Node {id: $src, user_id: $uid}), (b:Node {id: $tgt, user_id: $uid}) "
                                "MERGE (a)-[r:RELATES_TO {label: $label}]->(b)",
                                src=edge['source'], tgt=edge['target'], uid=str(user_id), label=edge.get('label', 'related')
                            )
            except Exception as e:
                logger.warning(f"Neo4j ingestion failed: {e}")
        
        nodes = []
        for n in graph_data.get('nodes', []):
            if n.get('type') == 'document':
                n['color'] = '#3b82f6'
            else:
                n['color'] = '#8b5cf6'
            n['size'] = 30
            nodes.append(n)
            
        return {
            'nodes': nodes,
            'edges': graph_data.get('edges', []),
            'stats': {
                'total_nodes': len(nodes),
                'total_edges': len(graph_data.get('edges', []))
            }
        }
            
    except Exception as e:
        logger.error(f"KG generation failed: {e}")
        return _generate_mock_knowledge_graph(documents)


def _generate_mock_knowledge_graph(documents):
    """Generate a mock knowledge graph from user's documents."""
    nodes = []
    edges = []
    node_ids = set()
    
    for doc in documents:
        doc_id = f"doc_{doc.get('id', 0)}"
        nodes.append({
            'id': doc_id,
            'label': doc.get('title', 'Untitled'),
            'type': 'document',
            'color': '#3b82f6',
            'size': 30,
        })
        node_ids.add(doc_id)
        
        content = doc.get('content', doc.get('content_text', ''))
        if content:
            words = re.findall(r'\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b', content)
            word_freq = defaultdict(int)
            for w in words:
                word_freq[w] += 1
            
            top_concepts = sorted(word_freq.items(), key=lambda x: -x[1])[:8]
            for concept, freq in top_concepts:
                concept_id = f"concept_{concept.lower().replace(' ', '_')}"
                if concept_id not in node_ids:
                    nodes.append({
                        'id': concept_id,
                        'label': concept,
                        'type': 'concept',
                        'color': '#8b5cf6',
                        'size': min(10 + freq * 3, 40),
                    })
                    node_ids.add(concept_id)
                
                edges.append({
                    'source': doc_id,
                    'target': concept_id,
                    'weight': freq,
                    'label': 'contains',
                })
    
    concept_docs = defaultdict(set)
    for edge in edges:
        if edge['target'].startswith('concept_'):
            concept_docs[edge['target']].add(edge['source'])
    
    concept_list = list(concept_docs.keys())
    for i in range(len(concept_list)):
        for j in range(i + 1, len(concept_list)):
            shared = concept_docs[concept_list[i]] & concept_docs[concept_list[j]]
            if shared:
                edges.append({
                    'source': concept_list[i],
                    'target': concept_list[j],
                    'weight': len(shared),
                    'label': 'related',
                })
    
    return {
        'nodes': nodes,
        'edges': edges,
        'stats': {
            'total_nodes': len(nodes),
            'total_edges': len(edges),
        },
    }


def generate_quiz(topic: str, content: str = '', num_questions: int = 5, difficulty: str = 'medium') -> dict:
    """Generate quiz questions from topic and content using strict JSON format."""
    try:
        import google.generativeai as genai
        import json
        from flask import current_app
        
        api_key = current_app.config.get('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            
            diff_prompt = "Generate application-based MCQs."
            if difficulty == "easy":
                diff_prompt = "Generate simple recall-based MCQs."
            elif difficulty == "hard":
                diff_prompt = "Generate tricky MCQs with similar-looking wrong options."
                
            prompt = f"""You are an advanced AI tutor and quiz generator.
The user provided the topic: "{topic}"
The number of questions requested: {num_questions}
Difficulty: {diff_prompt}

Rules for the quiz:
* The number of questions must match the provided value.
* Each question must test real conceptual understanding.
* Each question must contain exactly 4 meaningful options.
* Only one option must be correct.
* Avoid vague answers such as "None of these", "Random option", or placeholders.

Rules for explanation:
* Explain the topic clearly and logically.
* Include: definition, core principles, important ideas, and real-world context if relevant.
* The explanation should be understandable for a learner.

Return ONLY valid JSON in the following format:
{{
  "quiz": [
    {{
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": "...",
      "reasoning": "A one-line explanation of why this answer is correct."
    }}
  ],
  "explanation": "..."
}}

Ensure:
* Questions directly relate to the topic.
* Content is educational, accurate, and structured.
* No text outside the JSON output.

Based on this content (if any):
{content[:15000]}
"""

            response = call_gemini(model, prompt, generation_config={"response_mime_type": "application/json"})
            text = response.text
            
            # Gemini sometimes wraps JSON in markdown block even with application/json specified
            if text.startswith('```json'):
                text = text.replace('```json\n', '').replace('```', '').strip()
            elif text.startswith('```'):
                text = text.replace('```\n', '').replace('```', '').strip()
                
            try:
                quiz_data = json.loads(text)
                return quiz_data
            except json.JSONDecodeError as decode_err:
                logger.error(f"Failed to parse Gemini JSON output: {decode_err}. Raw output was: {text[:500]}...")
                raise ValueError("Invalid JSON from AI")
                
    except Exception as e:
        logger.error(f"Quiz generation failed: {e}")
    
    # Fallback mock quiz in exact requested format
    return {
        "quiz": [
            {
                "question": f"What is a key concept in {topic}?",
                "options": ["Fundamentals", "Random Topic", "Unrelated", "None of these"],
                "correct": "Fundamentals",
                "reasoning": "Fundamentals form the core building blocks."
            },
            {
                "question": f"Which approach is commonly used in {topic}?",
                "options": ["Trial and error", "Structured learning", "Guessing", "Ignoring"],
                "correct": "Structured learning",
                "reasoning": "Structured learning yields the most consistent progress."
            },
            {
                "question": f"What should you focus on first when studying {topic}?",
                "options": ["Advanced topics", "Core principles", "Edge cases", "History"],
                "correct": "Core principles",
                "reasoning": "Core principles must be understood before examining edge cases."
            }
        ],
        "explanation": f"This is a fallback explanation since AI generation failed. The core principles of {topic} form the foundation of understanding."
    }


def summarize_document(content: str, max_length: int = 500) -> str:
    """Summarize a document's content."""
    try:
        import google.generativeai as genai
        from flask import current_app
        
        api_key = current_app.config.get('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            response = call_gemini(model, f"Summarize this text in {max_length} characters or less:\n\n{content[:4000]}")
            return response.text
    except Exception as e:
        logger.warning(f"Summarization failed: {e}")
    
    # Fallback: simple extractive summary
    sentences = content.split('.')
    summary = '. '.join(sentences[:5]).strip()
    if len(summary) > max_length:
        summary = summary[:max_length - 3] + '...'
    return summary or "No content available for summarization."


def explain_concept(concept: str, context: str = '') -> str:
    """Explain a concept, optionally with context from user's documents."""
    try:
        import google.generativeai as genai
        from flask import current_app
        
        api_key = current_app.config.get('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            model = genai.GenerativeModel(GEMINI_MODEL)
            prompt = f"Explain '{concept}' clearly and concisely."
            if context:
                prompt += f"\n\nContext from user's notes: {context[:2000]}"
            
            response = call_gemini(model, prompt)
            return response.text
    except Exception as e:
        logger.warning(f"Explanation failed: {e}")
    
    return f"**{concept}** is a topic that encompasses various interconnected ideas. To get a deeper understanding, try uploading relevant documents and asking the AI assistant for a detailed explanation based on your personal knowledge base."


# ---------- Mind Map CRUD ----------

def save_mind_map(user_id, title, topic, mindmap_data):
    """Save a mind map to the database."""
    res = sb_insert('mind_maps', {
        'user_id': user_id,
        'title': title,
        'topic': topic,
        'mindmap_data': mindmap_data,
    })
    
    # Check achievements
    try:
        from services.achievement_service import check_and_award_achievements
        check_and_award_achievements(user_id, 'mind_map_created')
    except Exception as e:
        logger.warning(f"Failed to award achievement: {e}")
        
    return res.data[0] if res.data else None


def get_user_mind_maps(user_id):
    """Get all mind maps for a user."""
    return sb_select('mind_maps', eq=('user_id', user_id), order=('created_at', {'ascending': False}))


def get_mind_map(user_id, map_id):
    """Get a single mind map with ownership check."""
    mm = sb_select('mind_maps', match={'id': map_id, 'user_id': user_id}, single=True)
    return mm


def update_mind_map(user_id, map_id, title=None, mindmap_data=None):
    """Update a mind map (e.g. after editing nodes)."""
    updates = {}
    if title: updates['title'] = title
    if mindmap_data: updates['mindmap_data'] = mindmap_data
    
    if not updates: return get_mind_map(user_id, map_id)
    
    res = sb_update('mind_maps', updates, match={'id': map_id, 'user_id': user_id})
    return res.data[0] if res.data else None


def delete_mind_map(user_id, map_id):
    """Delete a mind map."""
    res = sb_delete('mind_maps', match={'id': map_id, 'user_id': user_id})
    return len(res.data) > 0


def convert_mindmap_to_roadmap(user_id, mindmap_data, level='beginner', time_available='2 hours/day'):
    """Convert a mind map into a learning roadmap."""
    from services.ai_service import generate_roadmap
    
    root_label = mindmap_data.get('label', 'Learning Plan')
    # Use the AI roadmap generation for a better result than simple conversion
    return generate_roadmap(user_id, root_label, level, time_available)


def generate_tutor_followup(topic: str, question: str, context: list) -> str:
    """Generate a targeted response based on a user's follow-up question about their failed quiz questions."""
    try:
        import google.generativeai as genai
        from flask import current_app
        import logging
        logger = logging.getLogger(__name__)
        
        api_key = current_app.config.get('GEMINI_API_KEY')
        if not api_key:
            return "AI API key not configured."
            
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(GEMINI_MODEL)
        
        prompt = f"""You are an encouraging and highly knowledgeable AI Tutor.
The user just completed a quiz on "{topic}".
Here is what they got wrong recently and the correct answers:
{context}

The user has a follow-up question: "{question}"

Instructions:
1. Answer the user's question directly, clearly, and concisely.
2. If related to what they got wrong, gently explain the core concept they missed.
3. Use markdown for bolding, bullet points, and code blocks if necessary.
4. Keep the response concise, encouraging, and highly educational.
"""
        response = call_gemini(model, prompt)
        return response.text
    except Exception as e:
        logger.warning(f"Tutor followup failed: {e}")
        return "Sorry, I couldn't generate an explanation right now. Please try again later."
