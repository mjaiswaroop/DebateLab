"""add_redos_pauses_drills_and_ballots

Revision ID: ee9719006e11
Revises: fbab095c5271
Create Date: 2026-10-17 19:43:39.799032

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'ee9719006e11'
down_revision: Union[str, None] = 'fbab095c5271'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

JSON_TYPE = sa.JSON().with_variant(postgresql.JSONB(astext_type=sa.Text()), 'postgresql')


def upgrade() -> None:
    # 1. Create judge_ballots table
    op.create_table(
        'judge_ballots',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=False),
        sa.Column('persona', sa.String(length=20), nullable=False),
        sa.Column('winner', sa.String(length=20), nullable=False),
        sa.Column('user_score', sa.SmallInteger(), nullable=False),
        sa.Column('opponent_score', sa.SmallInteger(), nullable=False),
        sa.Column('rfd', sa.Text(), nullable=False),
        sa.Column('key_factors', JSON_TYPE, nullable=False, server_default='[]'),
        sa.Column('what_would_change_decision', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['debate_sessions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Create user_drills table
    op.create_table(
        'user_drills',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('session_id', sa.Uuid(), nullable=True),
        sa.Column('drill_type', sa.String(length=30), nullable=False),
        sa.Column('prompt_text', sa.Text(), nullable=False),
        sa.Column('duration_seconds', sa.Integer(), nullable=False),
        sa.Column('score', sa.SmallInteger(), nullable=False),
        sa.Column('target_metric', sa.String(length=30), nullable=False),
        sa.Column('triggering_weakness', sa.String(length=50), nullable=True),
        sa.Column('metrics', JSON_TYPE, nullable=False, server_default='{}'),
        sa.Column('feedback', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('(CURRENT_TIMESTAMP)'), nullable=False),
        sa.ForeignKeyConstraint(['session_id'], ['debate_sessions.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 3. Batch alter debate_sessions for SQLite compatibility
    with op.batch_alter_table('debate_sessions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('format', sa.String(length=24), nullable=False, server_default='parliamentary'))
        batch_op.add_column(sa.Column('target_wpm_min', sa.SmallInteger(), nullable=False, server_default='160'))
        batch_op.add_column(sa.Column('target_wpm_max', sa.SmallInteger(), nullable=False, server_default='200'))

    # 4. Batch alter debate_turns for SQLite compatibility
    with op.batch_alter_table('debate_turns', schema=None) as batch_op:
        batch_op.add_column(sa.Column('parent_turn_id', sa.Uuid(), nullable=True))
        batch_op.add_column(sa.Column('attempt_number', sa.SmallInteger(), nullable=False, server_default='1'))
        batch_op.add_column(sa.Column('pauses_detected', JSON_TYPE, nullable=False, server_default='[]'))
        batch_op.add_column(sa.Column('verified_fallacy_count', sa.SmallInteger(), nullable=True, server_default='0'))
        batch_op.add_column(sa.Column('total_fallacy_count', sa.SmallInteger(), nullable=True, server_default='0'))
        batch_op.create_unique_constraint('uq_session_turn_speaker_attempt', ['session_id', 'turn_number', 'speaker', 'attempt_number'])
        batch_op.create_foreign_key('fk_turn_parent', 'debate_turns', ['parent_turn_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    with op.batch_alter_table('debate_turns', schema=None) as batch_op:
        batch_op.drop_constraint('fk_turn_parent', type_='foreignkey')
        batch_op.drop_constraint('uq_session_turn_speaker_attempt', type_='unique')
        batch_op.drop_column('total_fallacy_count')
        batch_op.drop_column('verified_fallacy_count')
        batch_op.drop_column('pauses_detected')
        batch_op.drop_column('attempt_number')
        batch_op.drop_column('parent_turn_id')

    with op.batch_alter_table('debate_sessions', schema=None) as batch_op:
        batch_op.drop_column('target_wpm_max')
        batch_op.drop_column('target_wpm_min')
        batch_op.drop_column('format')

    op.drop_table('user_drills')
    op.drop_table('judge_ballots')
