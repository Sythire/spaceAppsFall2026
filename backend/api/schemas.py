"""Validated scenario inputs shared by the scientific HTTP endpoints."""
from typing import List, Literal, Optional
from datetime import timedelta

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, field_validator, model_validator


class Location(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    id: str = Field(min_length=1, max_length=128)
    name: str = Field(min_length=1, max_length=200)
    latitudeDeg: float = Field(ge=-90, le=90)
    longitudeDeg: float = Field(ge=-180, le=180)
    frame: Literal["MOON_ME"]
    kind: Optional[Literal["historical", "exploratory", "clps-landed", "clps-planned"]] = None
    source: Optional[str] = None
    coordinateFrame: Optional[str] = None
    coordinateNote: Optional[str] = None
    # Catalogue metadata on CLPS sites (see catalog.py); informational only.
    status: Optional[str] = Field(default=None, max_length=300)
    program: Optional[str] = Field(default=None, max_length=100)


class AnalysisRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    location: Location
    utc: AwareDatetime
    durationHours: float = Field(default=720, ge=1 / 3600, le=2880)
    stepHours: float = Field(default=1, ge=0.25, le=24)

    @field_validator("utc", mode="before")
    @classmethod
    def iso_timestamp(cls, value):
        if not isinstance(value, str) or "T" not in value:
            raise ValueError("utc must be an ISO 8601 timestamp with a timezone")
        return value

    @model_validator(mode="after")
    def bounded_samples(self):
        if self.durationHours / self.stepHours > 4000:
            raise ValueError("Too many samples; increase stepHours or reduce durationHours")
        try:
            self.utc + timedelta(hours=self.durationHours)
        except OverflowError as exc:
            raise ValueError("Scenario end exceeds supported calendar dates") from exc
        return self


class ComparisonRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    requests: List[AnalysisRequest] = Field(min_length=1, max_length=3)
