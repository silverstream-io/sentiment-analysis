from typing import Dict, List, Optional
from pydantic import BaseModel

class CommentResponse(BaseModel):
    commentId: str
    text: Optional[str]
    createdAt: Optional[str]

class TicketResponse(BaseModel):
    ticketId: str
    comments: Optional[List[CommentResponse]]
