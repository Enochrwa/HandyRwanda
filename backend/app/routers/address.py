# File: backend/app/routers/address.py
"""
Rwanda address hierarchy endpoints.

Full 5-level cascade (Province → District → Sector → Cell → Village):

GET /address/provinces              — list all provinces
GET /address/districts              — list all districts (optionally filter by province)
GET /address/sectors                — list sectors in a district
GET /address/cells                  — list cells in a sector
GET /address/villages               — list villages in a cell
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
    cell: str = Query(...),
) -> Any:
    """Returns the real villages within a cell (5th level of Rwanda's hierarchy)."""
    villages = get_villages(province, district, sector, cell)
    if not villages:
        raise HTTPException(
            status_code=404,
            detail=f"No villages found for cell '{cell}', sector '{sector}', district '{district}'.",
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

@router.get("/validate")
async def validate_address(
    province: str = Query(...),
    district: str = Query(...),
    sector: str | None = Query(None),
    cell: str | None = Query(None),
    village: str | None = Query(None),
) -> Any:
    """
    Validate that an address selection is internally consistent.
    Returns {valid: bool, errors: list[str]}.
    """
    errors: list[str] = []

    provinces = get_provinces()
    if province not in provinces:
        errors.append(f"Unknown province: '{province}'. Valid: {provinces}")
        return {"valid": False, "errors": errors}

    districts = get_districts(province)
    if district not in districts:
        errors.append(f"District '{district}' not found in province '{province}'")
        return {"valid": False, "errors": errors}

    if sector:
        sectors = get_sectors(province, district)
        if sector not in sectors:
            errors.append(f"Sector '{sector}' not found in district '{district}'")
            return {"valid": False, "errors": errors}

        if cell:
            cells = get_cells(province, district, sector)
            if cell not in cells:
                errors.append(f"Cell '{cell}' not found in sector '{sector}'")
                return {"valid": False, "errors": errors}

            if village:
                villages = get_villages(province, district, sector, cell)
                if village not in villages:
                    errors.append(f"Village '{village}' not found in cell '{cell}'")
                    return {"valid": False, "errors": errors}

    return {"valid": True, "errors": []}


@router.get("/hierarchy")
async def get_full_hierarchy(
    province: str = Query(...),
    district: str = Query(...),
    sector: str | None = Query(None),
    cell: str | None = Query(None),
) -> Any:
    """
    Returns available options at each level given the current selections.
    Useful for initialising all dropdowns in a single API call.
    """
    result: dict[str, Any] = {
        "districts": get_districts(province),
        "sectors": get_sectors(province, district) if district else [],
        "cells": get_cells(province, district, sector) if sector is not None else [],
        "villages": (
            get_villages(province, district, sector, cell)
            if sector is not None and cell is not None
            else []
        ),
    }
    return result
