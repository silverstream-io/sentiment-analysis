from typing import Dict, List, Optional, Union
from pydantic import BaseModel, Field

class CommentInput(BaseModel):
    id: str
    body: Optional[str] = None
    created_at: Optional[Union[str, int]] = None
    score: Optional[float] = None
    author_id: Optional[Union[str, int]] = None
    ticket_requestor_id: Optional[Union[str, int]] = None
    ticket_assignee_id: Optional[Union[str, int]] = None

class TicketInput(BaseModel):
    id: str
    comments: Optional[List[CommentInput]] = None
    score: Optional[float] = None
    requestor: Optional[dict] = None
    assignee: Optional[dict] = None
    status: Optional[str] = None
    updated_at: Optional[Union[str, int]] = None
    created_at: Optional[Union[str, int]] = None

class CommentResponse(CommentInput):
    emotion_score: Optional[float] = None

class TicketResponse(TicketInput):
    comments: Optional[List[CommentResponse]] = None
    weighted_score: Optional[float] = None

