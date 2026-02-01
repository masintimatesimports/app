import logging
from typing import Optional
from app.core.supabase import supabase

logger = logging.getLogger(__name__)

class ColumnManager:
    """Manages dynamic column additions to shipments table"""
    
    # Map field types to PostgreSQL types
    TYPE_MAPPING = {
        'text': 'TEXT',
        'string': 'TEXT',
        'number': 'NUMERIC',
        'numeric': 'NUMERIC',
        'integer': 'INTEGER',
        'date': 'DATE',
        'datetime': 'TIMESTAMP',
        'boolean': 'BOOLEAN'
    }
    
    # Reserved column names (PostgreSQL + our system)
    RESERVED_COLUMNS = {
        'id', 'created_at', 'updated_at', 'custom_fields',
        'agent_id', 'hbl_number', 'last_excel_upload_at'
    }
    
    # Cache of existing columns
    _column_cache = None
    
    @classmethod
    def validate_column_name(cls, column_name: str) -> tuple[bool, str]:
        """Validate column name is safe and available"""
        # Check if reserved
        if column_name.lower() in cls.RESERVED_COLUMNS:
            return False, f"Column name '{column_name}' is reserved"
        
        # Check for SQL injection patterns
        if any(char in column_name for char in [';', '--', '/*', '*/', '\'', '"', '(', ')', '=', '>', '<']):
            return False, "Invalid characters in column name"
        
        # Check length
        if len(column_name) > 63:  # PostgreSQL limit
            return False, "Column name too long (max 63 chars)"
        
        # Must start with letter or underscore
        if not (column_name[0].isalpha() or column_name[0] == '_'):
            return False, "Column name must start with a letter or underscore"
        
        # Only alphanumeric and underscores
        if not all(c.isalnum() or c == '_' for c in column_name):
            return False, "Column name can only contain letters, numbers, and underscores"
        
        return True, "Valid"
    
    @classmethod
    def get_postgres_type(cls, field_type: str) -> str:
        """Map field type to PostgreSQL data type"""
        return cls.TYPE_MAPPING.get(field_type.lower(), 'TEXT')
    
    @classmethod
    def get_existing_columns(cls) -> set:
        """Get list of existing columns in shipments table"""
        if cls._column_cache is not None:
            return cls._column_cache
        
        try:
            # Try to infer columns by checking a sample row
            # This is a workaround since we can't query information_schema directly
            result = supabase.table("shipments").select("*").limit(1).execute()
            
            if result.data:
                # Get columns from first row's keys
                columns = set(result.data[0].keys())
                cls._column_cache = columns
                logger.info(f"Found existing columns: {sorted(columns)}")
                return columns
            else:
                # Empty table, return known columns
                known_columns = {
                    "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
                    "vessel_name", "voyage_no", "eta", "clearance_status",
                    "last_excel_upload_at", "created_at", "updated_at", "custom_fields"
                }
                cls._column_cache = known_columns
                return known_columns
                
        except Exception as e:
            logger.error(f"Error getting existing columns: {e}")
            # Return known columns as fallback
            known_columns = {
                "agent_id", "hbl_number", "mbl_number", "po_number", "consignee",
                "vessel_name", "voyage_no", "eta", "clearance_status",
                "last_excel_upload_at", "created_at", "updated_at", "custom_fields"
            }
            cls._column_cache = known_columns
            return known_columns
    
    @classmethod
    def column_exists(cls, column_name: str) -> bool:
        """Check if column already exists in shipments table"""
        existing_columns = cls.get_existing_columns()
        return column_name in existing_columns

    @classmethod
    def add_column(cls, column_name: str, field_type: str) -> tuple[bool, str]:
        """
        Add a new column to shipments table using Supabase RPC
        Returns: (success, message)
        """
        import time  # Add this import at the top of the file or here
        
        # Validate column name
        is_valid, msg = cls.validate_column_name(column_name)
        if not is_valid:
            return False, msg
        
        # Check if already exists
        if cls.column_exists(column_name):
            return True, f"Column '{column_name}' already exists"
        
        # Get PostgreSQL type
        pg_type = cls.get_postgres_type(field_type)
        
        try:
            # Call the PostgreSQL function via Supabase RPC
            # Change the parameter names to match the function
            result = supabase.rpc(
                'add_shipment_column',
                {
                    'p_column_name': column_name,  # Changed from 'column_name'
                    'p_data_type': pg_type         # Changed from 'data_type'
                }
            ).execute()
            
            # Debug: Print the raw result
            print(f"DEBUG: Raw RPC result: {result}")
            print(f"DEBUG: Result type: {type(result)}")
            print(f"DEBUG: Result.data: {result.data}")
            print(f"DEBUG: Result.data type: {type(result.data)}")
            
            # Handle different response formats
            if hasattr(result, 'data'):
                response_data = result.data
                
                if isinstance(response_data, str):
                    # Direct string response
                    if 'SUCCESS' in response_data.upper():
                        cls._column_cache = None
                        logger.info(f"Successfully added column '{column_name}': {response_data}")
                        return True, response_data
                    elif 'ERROR' in response_data.upper():
                        logger.error(f"Failed to add column '{column_name}': {response_data}")
                        return False, response_data
                    else:
                        # Generic success
                        cls._column_cache = None
                        return True, f"Column '{column_name}' added: {response_data}"
                        
                elif isinstance(response_data, dict):
                    # Dict response (JSON)
                    success = response_data.get('success', False)
                    message = response_data.get('message', 'Unknown')
                    
                    if success:
                        cls._column_cache = None
                        logger.info(f"Successfully added column '{column_name}': {message}")
                        return True, message
                    else:
                        logger.error(f"Failed to add column '{column_name}': {message}")
                        return False, message
                        
                elif response_data is None:
                    # Void function, no return
                    cls._column_cache = None
                    return True, f"Column '{column_name}' added successfully"
                    
                else:
                    # Unknown format
                    logger.warning(f"Unexpected response format: {response_data}")
                    cls._column_cache = None
                    return True, f"Column add executed: {str(response_data)[:100]}"
            else:
                # No data attribute
                logger.warning(f"No data in response: {result}")
                cls._column_cache = None
                return True, "Column add executed (no response data)"
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Error calling add_shipment_column: {error_msg}")
            
            # Wait and check if column was actually added
            time.sleep(1)
            if cls.column_exists(column_name):
                cls._column_cache = None
                return True, f"Column '{column_name}' added (verified after error)"
            
            # Provide user-friendly error messages
            if "function public.add_shipment_column" in error_msg:
                return False, "Database function not available"
            elif "permission denied" in error_msg.lower():
                return False, "Permission denied"
            else:
                return False, f"Database error: {error_msg}"  



    @classmethod
    def sync_all_columns(cls) -> dict:
        """Check all fields and ensure their columns exist"""
        try:
            # Get all active fields
            fields_res = supabase.table("shipment_fields") \
                .select("*") \
                .eq("active", True) \
                .execute()
            
            results = {}
            existing_columns = cls.get_existing_columns()
            
            for field in (fields_res.data or []):
                field_key = field["field_key"]
                
                if field_key in existing_columns:
                    results[field_key] = {
                        "status": "exists",
                        "message": "Column already exists"
                    }
                else:
                    results[field_key] = {
                        "status": "missing",
                        "message": f"Column '{field_key}' needs to be added",
                        "pg_type": cls.get_postgres_type(field["field_type"])
                    }
            
            return results
            
        except Exception as e:
            logger.error(f"Error syncing columns: {e}")
            return {"error": str(e)}