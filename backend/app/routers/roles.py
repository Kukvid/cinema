from typing import List, Annotated
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.role import Role
from app.models.user import User
from app.routers.auth import get_current_active_user

router = APIRouter()


@router.get("", response_model=List[dict])
async def get_roles(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    search: str | None = Query(None, description="Search by role name"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get list of roles with pagination and search."""
    # Only admin users should be able to see roles
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access role management"
        )

    query = select(Role)

    if search:
        search_filter = f"%{search}%"
        query = query.filter(Role.name.ilike(search_filter))

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    roles = result.scalars().all()

    return [{"id": role.id, "name": role.name} for role in roles]


@router.get("/{role_id}", response_model=dict)
async def get_role(
    role_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Get role by ID."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can access role details"
        )

    result = await db.execute(select(Role).filter(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    return {"id": role.id, "name": role.name}


@router.post("", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_role(
    role_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new role."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can create roles"
        )

    # Check if role already exists
    result = await db.execute(select(Role).filter(Role.name == role_data["name"]))
    existing_role = result.scalar_one_or_none()

    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{role_data['name']}' already exists"
        )

    new_role = Role(name=role_data["name"])
    db.add(new_role)
    await db.commit()
    await db.refresh(new_role)

    return {"id": new_role.id, "name": new_role.name}


@router.put("/{role_id}", response_model=dict)
async def update_role(
    role_id: int,
    role_data: dict,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Update role by ID."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can update roles"
        )

    result = await db.execute(select(Role).filter(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Check if new name already exists (excluding current role)
    result = await db.execute(
        select(Role).filter(Role.name == role_data["name"], Role.id != role_id)
    )
    existing_role = result.scalar_one_or_none()

    if existing_role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role with name '{role_data['name']}' already exists"
        )

    # Update role
    role.name = role_data["name"]
    await db.commit()
    await db.refresh(role)

    return {"id": role.id, "name": role.name}


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(
    role_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete role by ID."""
    if not current_user.role or current_user.role.name != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can delete roles"
        )

    result = await db.execute(select(Role).filter(Role.id == role_id))
    role = result.scalar_one_or_none()

    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Role with id {role_id} not found"
        )

    # Check if role is assigned to any users
    users_with_role = await db.execute(
        select(User).filter(User.role_id == role_id)
    )
    users = users_with_role.scalars().all()

    if users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete role '{role.name}' because it's assigned to {len(users)} user(s)"
        )

    await db.delete(role)
    await db.commit()

    return None