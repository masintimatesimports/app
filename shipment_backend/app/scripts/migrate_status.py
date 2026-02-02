# Run once: python -m app.scripts.migrate_status
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.services.status_categorizer import StatusCategorizer
from app.core.supabase import supabase

# migrate_status.py
def migrate():
    page = 0
    batch_size = 100
    
    while True:
        # Get shipments without standardized_status
        res = supabase.table("shipments") \
            .select("agent_id, hbl_number, clearance_status") \
            .is_("standardized_status", "null") \
            .range(page * batch_size, (page + 1) * batch_size - 1) \
            .execute()
        
        if not res.data:
            print("Migration complete!")
            break
            
        for shipment in res.data:
            raw_status = shipment["clearance_status"]
            standardized = StatusCategorizer.categorize_status(str(raw_status) if raw_status else "")
            
            # Use composite key for update
            supabase.table("shipments") \
                .update({"standardized_status": standardized}) \
                .eq("agent_id", shipment["agent_id"]) \
                .eq("hbl_number", shipment["hbl_number"]) \
                .execute()
        
        page += 1
        print(f"Processed {page * batch_size} shipments")

if __name__ == "__main__":
    migrate()