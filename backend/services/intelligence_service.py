"""Mind map and knowledge graph generation service."""
import json
import logging
import re
from collections import defaultdict

logger = logging.getLogger(__name__)


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
    
    # Try Groq for intelligent map
    try:
        import groq
        import os
        from flask import current_app
        from config import config_map
        
        env = os.getenv('FLASK_ENV', 'development')
        model = config_map.get(env).GROQ_MODEL if config_map.get(env) else 'llama3-70b-8192'
        
        api_key = current_app.config.get('GROQ_API_KEY')
        if api_key:
            client = groq.Groq(api_key=api_key)
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
            
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.6,
                max_tokens=3000,
            )
            content = response.choices[0].message.content
            # Parse JSON from response
            json_match = re.search(r'\{[\s\S]*\}', content)
            if json_match:
                return json.loads(json_match.group())
    except Exception as e:
        logger.warning(f"Groq mind map generation failed: {e}")
    
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
    """Generate a knowledge graph from user's documents."""
    
    nodes = []
    edges = []
    node_ids = set()
    
    # Each document becomes a node
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
        
        # Extract concepts from content
        content = doc.get('content', doc.get('content_text', ''))
        if content:
            # Simple concept extraction
            words = re.findall(r'\b[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]+)*\b', content)
            word_freq = defaultdict(int)
            for w in words:
                word_freq[w] += 1
            
            # Top concepts become nodes
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
    
    # Find concept-to-concept relationships (co-occurrence)
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
            'documents': len([n for n in nodes if n['type'] == 'document']),
            'concepts': len([n for n in nodes if n['type'] == 'concept']),
        },
    }


def generate_quiz(topic: str, content: str = '', num_questions: int = 5) -> dict:
    """Generate quiz questions from topic and content using strict JSON format."""
    try:
        import groq
        import json
        import re
        import os
        from flask import current_app
        from config import config_map
        
        env = os.getenv('FLASK_ENV', 'development')
        model = config_map.get(env).GROQ_MODEL if config_map.get(env) else 'llama3-70b-8192'
        
        api_key = current_app.config.get('GROQ_API_KEY')
        if api_key:
            client = groq.Groq(api_key=api_key)
            prompt = f"""You are an advanced AI tutor and quiz generator.
The user provided the topic: "{topic}"
The number of questions requested: {num_questions}

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
      "correct": "..."
    }}
  ],
  "explanation": "..."
}}

Ensure:
* Questions directly relate to the topic.
* Content is educational, accurate, and structured.
* No text outside the JSON output.

Based on this content (if any):
{content[:2000]}
"""

            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.7,
                response_format={ "type": "json_object" }
            )
            text = response.choices[0].message.content
            return json.loads(text)
    except Exception as e:
        logger.warning(f"Quiz generation failed: {e}")
    
    # Fallback mock quiz in exact requested format
    return {
        "quiz": [
            {
                "question": f"What is a key concept in {topic}?",
                "options": ["Fundamentals", "Random Topic", "Unrelated", "None of these"],
                "correct": "Fundamentals",
            },
            {
                "question": f"Which approach is commonly used in {topic}?",
                "options": ["Trial and error", "Structured learning", "Guessing", "Ignoring"],
                "correct": "Structured learning",
            },
            {
                "question": f"What should you focus on first when studying {topic}?",
                "options": ["Advanced topics", "Core principles", "Edge cases", "History"],
                "correct": "Core principles",
            }
        ],
        "explanation": f"This is a fallback explanation since AI generation failed. The core principles of {topic} form the foundation of understanding."
    }


def summarize_document(content: str, max_length: int = 500) -> str:
    """Summarize a document's content."""
    try:
        import groq
        import os
        from flask import current_app
        from config import config_map
        
        env = os.getenv('FLASK_ENV', 'development')
        model = config_map.get(env).GROQ_MODEL if config_map.get(env) else 'llama3-70b-8192'

        api_key = current_app.config.get('GROQ_API_KEY')
        if api_key:
            client = groq.Groq(api_key=api_key)
            response = client.chat.completions.create(
                model=model,
                messages=[{
                    "role": "user",
                    "content": f"Summarize this text in {max_length} characters or less:\n\n{content[:4000]}"
                }],
                temperature=0.3,
            )
            return response.choices[0].message.content
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
        import groq
        import os
        from flask import current_app
        from config import config_map
        
        env = os.getenv('FLASK_ENV', 'development')
        model = config_map.get(env).GROQ_MODEL if config_map.get(env) else 'llama3-70b-8192'

        api_key = current_app.config.get('GROQ_API_KEY')
        if api_key:
            client = groq.Groq(api_key=api_key)
            prompt = f"Explain '{concept}' clearly and concisely."
            if context:
                prompt += f"\n\nContext from user's notes: {context[:2000]}"
            
            response = client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.5,
            )
            return response.choices[0].message.content
    except Exception as e:
        logger.warning(f"Explanation failed: {e}")
    
    return f"**{concept}** is a topic that encompasses various interconnected ideas. To get a deeper understanding, try uploading relevant documents and asking the AI assistant for a detailed explanation based on your personal knowledge base."


# ---------- Mind Map CRUD ----------

def save_mind_map(user_id, title, topic, mindmap_data):
    """Save a mind map to the database."""
    from models import db, MindMap
    mm = MindMap(
        user_id=user_id,
        title=title,
        topic=topic,
        mindmap_data=mindmap_data,
    )
    db.session.add(mm)
    db.session.commit()
    return mm.to_dict()


def get_user_mind_maps(user_id):
    """Get all mind maps for a user."""
    from models import MindMap
    maps = MindMap.query.filter_by(user_id=user_id) \
        .order_by(MindMap.created_at.desc()).all()
    return [m.to_dict() for m in maps]


def get_mind_map(user_id, map_id):
    """Get a single mind map with ownership check."""
    from models import MindMap
    mm = MindMap.query.get(map_id)
    if not mm or mm.user_id != user_id:
        return None
    return mm.to_dict()


def update_mind_map(user_id, map_id, title=None, mindmap_data=None):
    """Update a mind map (e.g. after editing nodes)."""
    from models import db, MindMap
    mm = MindMap.query.get(map_id)
    if not mm or mm.user_id != user_id:
        return None
    if title:
        mm.title = title
    if mindmap_data:
        mm.mindmap_data = mindmap_data
    db.session.commit()
    return mm.to_dict()


def delete_mind_map(user_id, map_id):
    """Delete a mind map."""
    from models import db, MindMap
    mm = MindMap.query.get(map_id)
    if not mm or mm.user_id != user_id:
        return False
    db.session.delete(mm)
    db.session.commit()
    return True


def convert_mindmap_to_roadmap(user_id, mindmap_data, level='beginner', time_available='2 hours/day'):
    """Convert a mind map into a learning roadmap."""
    from models import db, Roadmap

    root_label = mindmap_data.get('label', 'Learning Plan')
    children = mindmap_data.get('children', [])

    phases = []
    total_hours = 0
    for i, branch in enumerate(children):
        branch_label = branch.get('label', f'Phase {i+1}')
        sub_topics = branch.get('children', [])
        topics = []
        phase_hours = 0
        for sub in sub_topics:
            hours = 5  # default estimate per topic
            topics.append({
                'title': sub.get('label', 'Topic'),
                'completed': False,
                'estimated_hours': hours,
                'resources': [],
            })
            phase_hours += hours
        if not topics:
            topics.append({
                'title': branch_label,
                'completed': False,
                'estimated_hours': 5,
                'resources': [],
            })
            phase_hours = 5

        total_hours += phase_hours
        phases.append({
            'id': f'phase-{i+1}',
            'title': branch_label,
            'description': f'Learn {branch_label} concepts and skills',
            'duration': f'{max(1, phase_hours // 10)} weeks',
            'estimated_hours': phase_hours,
            'status': 'not_started',
            'topics': topics,
        })

    roadmap_data = {
        'title': f'Roadmap: {root_label}',
        'total_estimated_hours': total_hours,
        'phases': phases,
    }

    roadmap = Roadmap(
        user_id=user_id,
        goal=root_label,
        level=level,
        time_available=time_available,
        roadmap_data=roadmap_data,
        progress=0.0,
    )
    db.session.add(roadmap)
    db.session.commit()
    return roadmap.to_dict()
