"""Plain-SQL geo helpers (no PostGIS required)."""

# Distance in km between a point (:lat, :lng) and ap.latitude / ap.longitude
HAVERSINE_KM_AP = """
    (6371 * acos(LEAST(1.0, GREATEST(-1.0,
        cos(radians(:lat)) * cos(radians(ap.latitude))
        * cos(radians(ap.longitude) - radians(:lng))
        + sin(radians(:lat)) * sin(radians(ap.latitude))
    ))))
"""
