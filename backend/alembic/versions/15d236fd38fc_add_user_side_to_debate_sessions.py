"""add_user_side_to_debate_sessions

Revision ID: 15d236fd38fc
Revises: ee9719006e11
Create Date: 2026-10-18 15:49:14.444551

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '15d236fd38fc'
down_revision: Union[str, None] = 'ee9719006e11'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Batch alter debate_sessions for SQLite & Postgres compatibility
    with op.batch_alter_table('debate_sessions', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('user_side', sa.String(length=12), nullable=False, server_default='government')
        )
    # Backfill existing rows to 'government'
    op.execute("UPDATE debate_sessions SET user_side = 'government' WHERE user_side IS NULL OR user_side = ''")


def downgrade() -> None:
    with op.batch_alter_table('debate_sessions', schema=None) as batch_op:
        batch_op.drop_column('user_side')
