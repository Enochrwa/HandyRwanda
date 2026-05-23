import os
from typing import Any, Callable, Coroutine
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

bearer = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer)) -> Any:
    try:
        payload = jwt.decode(
            credentials.credentials,
            os.getenv("JWT_SECRET", ""),
            algorithms=[os.getenv("JWT_ALGORITHM", "HS256")]
        )
        return payload  # {"sub": user_id, "role": role}
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

def require_role(*roles: str) -> Callable[[Any], Coroutine[Any, Any, Any]]:
    async def checker(user: Any = Depends(get_current_user)) -> Any:
        if user["role"] not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden"
            )
        return user
    return checker
