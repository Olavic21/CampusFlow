from datetime import datetime
from typing import Optional, Any
from pydantic import BaseModel, EmailStr, Field, field_validator


class RegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=255)
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=150)
    password: str = Field(..., min_length=8, max_length=128)
    password_confirm: str = Field(..., min_length=8, max_length=128)

    @field_validator("password_confirm")
    @classmethod
    def passwords_match(cls, v: str, info) -> str:
        if "password" in info.data and v != info.data["password"]:
            raise ValueError("Les mots de passe ne correspondent pas")
        return v


class LoginRequest(BaseModel):
    login: str = Field(..., description="Email ou nom d'utilisateur")
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: str
    username: str
    avatar: Optional[str] = None
    created_at: datetime
    last_login: Optional[datetime] = None

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class PreferencesOut(BaseModel):
    theme: str = "system"
    navigation_mode: str = "single"
    extra: Optional[dict[str, Any]] = None

    model_config = {"from_attributes": True}


class PreferencesUpdate(BaseModel):
    theme: Optional[str] = None
    navigation_mode: Optional[str] = None
    extra: Optional[dict[str, Any]] = None


class FavoriteLocationCreate(BaseModel):
    location_id: int
    label: Optional[str] = None


class FavoriteRouteCreate(BaseModel):
    start_location_id: int
    end_location_id: int
    label: Optional[str] = None
    distance_m: Optional[int] = None


class RouteHistoryCreate(BaseModel):
    start_location_id: int
    end_location_id: int
    distance_m: int
    duration_min: Optional[int] = None
    path_json: Optional[str] = None
