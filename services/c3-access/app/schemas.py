from typing import Any, Optional
from pydantic import BaseModel, Field


class OpenDoorIn(BaseModel):
    door_no: Optional[int] = None
    seconds: Optional[int] = Field(default=None, ge=1, le=254)


class PanelConfigIn(BaseModel):
    # e.g. {"Door1SensorType": 2, "Door1Drivertime": 5, "Door1SupperApb": 0}
    params: dict[str, Any]


class AllowlistEntry(BaseModel):
    card_no: int
    member_id: Optional[int] = None
    expires_at: Optional[float] = None  # epoch seconds


class AllowlistSyncIn(BaseModel):
    entries: list[AllowlistEntry]


class DecideIn(BaseModel):
    mode: str = Field(default="token", pattern="^(token|wiegand)$")
    value: str                          # token string, or card_no as string
    auto_open: bool = False             # open the door if allowed


class TokenValidateIn(BaseModel):
    token: str
