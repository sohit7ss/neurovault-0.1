import os
from supabase import create_client, Client
from flask import current_app

_supabase: Client = None

def get_supabase() -> Client:
    global _supabase
    if _supabase is None:
        url = current_app.config.get("SUPABASE_URL")
        key = current_app.config.get("SUPABASE_KEY")
        _supabase = create_client(url, key)
    return _supabase

# Helper methods to replace SQLAlchemy queries
def sb_insert(table: str, data: dict):
    return get_supabase().table(table).insert(data).execute()

def sb_select(table: str, match: dict = None, eq: tuple = None, single: bool = False, order: tuple = None):
    query = get_supabase().table(table).select("*")
    if match:
        query = query.match(match)
    if eq:
        query = query.eq(eq[0], eq[1])
    if order:
        col = order[0]
        opts = order[1] if len(order) > 1 else {}
        is_desc = not opts.get('ascending', True) if isinstance(opts, dict) else False
        query = query.order(col, desc=is_desc)
    
    res = query.execute()
    if single:
        return res.data[0] if res.data else None
    return res.data

def sb_update(table: str, data: dict, match: dict):
    return get_supabase().table(table).update(data).match(match).execute()

def sb_delete(table: str, match: dict = None, eq: tuple = None):
    query = get_supabase().table(table).delete()
    if match:
        query = query.match(match)
    if eq:
        query = query.eq(eq[0], eq[1])
    return query.execute()
