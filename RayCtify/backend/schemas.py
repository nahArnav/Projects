from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field, field_validator


class RecordEnvelope(BaseModel):
    records: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("records")
    @classmethod
    def validate_records(cls, value: list[dict[str, Any]]) -> list[dict[str, Any]]:
        if not value:
            raise ValueError("At least one record is required.")
        if len(value) > 500:
            raise ValueError("Batch size is capped at 500 records per request.")
        return value


class ParameterSpec(BaseModel):
    key: str
    label: str
    type: str
    min: float | None = None
    max: float | None = None
    step: float | None = None
    options: list[str] | None = None
    defaultValue: Any = None
    sensitive: bool = False
    description: str
    suffix: str | None = None

