from typing import Dict, List, Optional
from pydantic import BaseModel, Field

class CommentInput(BaseModel):
    commentId: str | int
    text: Optional[str] = None
    createdAt: Optional[str] = None
    score: Optional[float] = None
    author: Optional[str] = None

class TicketInput(BaseModel):
    ticketId: str | int
    comments: Optional[List[CommentInput]] = None
    score: Optional[float] = None
    requestor: Optional[str] = None
    assignee: Optional[str] = None
    state: Optional[str] = None
    updatedAt: Optional[str] = None
    createdAt: Optional[str] = None

class CommentResponse(CommentInput):
    pass

class TicketResponse(TicketInput):
    pass

