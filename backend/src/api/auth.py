import dotenv, os
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

dotenv.load_dotenv()

# Database setup
DATABASE_URL = os.getenv('DATABASE_URL')
#engine = create_engine(DATABASE_URL)
#Session = sessionmaker(bind=engine)
Base = declarative_base()

class AccessToken(Base):
    __tablename__ = 'access_tokens'
    installation_id = Column(String, primary_key=True)
    token = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

#Base.metadata.create_all(engine)

def create_access_token(installation_id, token):
    pass
    # session = Session()
    # access_token = AccessToken(installation_id=installation_id, token=token)
    # session.merge(access_token)
    # session.commit()
    # session.close()

def verify_access_token(token):
    return True
    # session = Session()
    # access_token = session.query(AccessToken).filter(AccessToken.token == token).first()
    # session.close()

    # if access_token:
    #     return access_token.installation_id
    #return None

def get_customer_credentials(installation_id):
    return {
        'AUTHORIZED': True
    }