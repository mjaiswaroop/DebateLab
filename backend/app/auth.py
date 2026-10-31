import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.models import User

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

security = HTTPBearer(auto_error=False)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


async def get_or_create_default_user(db: AsyncSession) -> User:
    """Finds or creates a default demo/guest user for local dev and anonymous exploration."""
    result = await db.execute(select(User).where(User.username == "guest_debater"))
    user = result.scalar_one_or_none()
    if user is None:
        user = User(
            id=uuid.uuid4(),
            username="guest_debater",
            email="guest@debatelab.local",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    return user


async def current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Authenticates user via Bearer JWT, or falls back to default guest user if no token is provided."""
    if credentials and credentials.credentials:
        token = credentials.credentials
        try:
            payload = jwt.decode(token, settings.secret_key, algorithms=[ALGORITHM])
            user_id: Optional[str] = payload.get("sub")
            if user_id:
                try:
                    uid = uuid.UUID(user_id)
                    result = await db.execute(select(User).where(User.id == uid))
                    user = result.scalar_one_or_none()
                    if user:
                        return user
                except ValueError:
                    pass
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token.",
                headers={"WWW-Authenticate": "Bearer"},
            )

    # In dev/guest mode, return default guest user so the user can immediately test
    return await get_or_create_default_user(db)
