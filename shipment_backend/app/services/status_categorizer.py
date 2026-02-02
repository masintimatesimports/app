from app.core.supabase import supabase

class StatusCategorizer:
    _patterns_cache = None
    _last_refresh = 0
    _cache_timeout = 300  # 5 minutes
    
    @classmethod
    def _refresh_cache(cls):
        """Refresh cache if needed"""
        import time
        current_time = time.time()
        
        if (cls._patterns_cache is None or 
            (current_time - cls._last_refresh) > cls._cache_timeout):
            
            patterns_res = supabase.table("status_pattern_mappings") \
                .select("*, shipment_status_categories(category_name)") \
                .eq("is_active", True) \
                .order("status_category_id") \
                .execute()
            
            cls._patterns_cache = patterns_res.data or []
            cls._last_refresh = current_time
    
    @staticmethod
    def categorize_status(raw_status: str) -> str:
        """Categorize raw status using pattern matching - CACHED"""
        if raw_status is None:
            return 'PENDING'
        
        raw_str = str(raw_status).strip()
        if raw_str == '' or raw_str.lower() == 'null' or raw_str.lower() == 'nan':
            return 'PENDING'
        
        # Ensure cache is fresh
        StatusCategorizer._refresh_cache()
        
        # Use cached patterns
        for pattern in StatusCategorizer._patterns_cache:
            pattern_text = pattern["raw_pattern"]
            match_type = pattern["match_type"]
            
            if match_type == 'EXACT' and raw_str.upper() == pattern_text.upper():
                return pattern["shipment_status_categories"]["category_name"]
            elif match_type == 'STARTS_WITH' and raw_str.upper().startswith(pattern_text.upper()):
                return pattern["shipment_status_categories"]["category_name"]
            elif match_type == 'CONTAINS' and pattern_text.upper() in raw_str.upper():
                return pattern["shipment_status_categories"]["category_name"]
            elif match_type == 'ENDS_WITH' and raw_str.upper().endswith(pattern_text.upper()):
                return pattern["shipment_status_categories"]["category_name"]
        
        return 'PENDING'