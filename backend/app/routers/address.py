# File: backend/app/routers/address.py
"""
Rwanda address hierarchy endpoints.

GET /address/provinces              — list all provinces
GET /address/districts              — list all districts (optionally filter by province)
GET /address/sectors                — list sectors in a district
GET /address/cells                  — list cells in a sector
GET /address/villages               — list villages (alias for cells at leaf level)
GET /address/format                 — format an address into a label string
"""

from typing import Any

from fastapi import APIRouter, HTTPException, Query

from app.utils.rwanda_address import (
    format_full_address,
    get_cells,
    get_districts,
    get_provinces,
    get_sectors,
    get_villages,
)

router = APIRouter(prefix="/address", tags=["address"])


@router.get("/provinces")
async def list_provinces() -> Any:
    return {"provinces": get_provinces()}


@router.get("/districts")
async def list_districts(province: str | None = Query(None)) -> Any:
    return {"districts": get_districts(province)}


@router.get("/sectors")
async def list_sectors(
    province: str = Query(...),
    district: str = Query(...),
) -> Any:
    sectors = get_sectors(province, district)
    if not sectors:
        raise HTTPException(
            status_code=404,
            detail=f"No sectors found for {district}, {province}. Check province/district names.",
        )
    return {"sectors": sectors}


@router.get("/cells")
async def list_cells(
    province: str = Query(...),
    district: str = Query(...),
    sector: str = Query(...),
) -> Any:
    cells = get_cells(province, district, sector)
    if not cells:
        raise HTTPException(
            status_code=404,
            detail=f"No cells found for {sector}, {district}.",
        )
    return {"cells": cells}


@router.get("/villages")
async def list_villages(
    province: str = Query(...),
    district: str = Query(...),
    sector: str = Query(...),
) -> Any:
    """
    Returns the leaf-level locality names for a sector.
    In Rwanda's NISR data these are cells/villages — same data as /cells.
    """
    villages = get_villages(province, district, sector)
    if not villages:
        raise HTTPException(
            status_code=404,
            detail=f"No villages found for {sector}, {district}.",
        )
    return {"villages": villages}


@router.get("/format")
async def format_address_endpoint(
    province: str | None = Query(None),
    district: str | None = Query(None),
    sector: str | None = Query(None),
    cell: str | None = Query(None),
    village: str | None = Query(None),
    street_road: str | None = Query(None),
    house_number: str | None = Query(None),
    landmark: str | None = Query(None),
) -> Any:
    label = format_full_address(
        province=province,
        district=district,
        sector=sector,
        cell=cell,
        village=village,
        street_road=street_road,
        house_number=house_number,
        landmark=landmark,
    )
    return {"formatted": label}
