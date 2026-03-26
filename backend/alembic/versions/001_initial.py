"""
Alembic initial migration — creates all tables
Run: alembic upgrade head
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # workspaces
    op.create_table(
        'workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('domain', sa.String(255), nullable=True),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('logo_url', sa.String(500), nullable=True),
        sa.Column('plan_tier', sa.String(20), nullable=True, server_default='starter'),
        sa.Column('stripe_customer_id', sa.String(100), nullable=True),
        sa.Column('stripe_subscription_id', sa.String(100), nullable=True),
        sa.Column('monthly_minutes_limit', sa.Integer(), nullable=True, server_default='6000'),
        sa.Column('monthly_minutes_used', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )

    # users
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('hashed_password', sa.String(255), nullable=True),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('avatar_url', sa.String(500), nullable=True),
        sa.Column('is_verified', sa.Boolean(), server_default='false'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('last_login_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('idx_users_email', 'users', ['email'])

    # workspace_members
    op.create_table(
        'workspace_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('role', sa.String(20), server_default='member'),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_workspace_member', 'workspace_members', ['workspace_id', 'user_id'], unique=True)

    # workspace_settings
    op.create_table(
        'workspace_settings',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('call_detection_keywords', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('auto_crm_sync', sa.Boolean(), server_default='false'),
        sa.Column('crm_provider', sa.String(30), nullable=True),
        sa.Column('sales_framework', sa.String(20), server_default='BANT'),
        sa.Column('followup_email_enabled', sa.Boolean(), server_default='true'),
        sa.Column('data_retention_days', sa.Integer(), server_default='90'),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workspace_id'),
    )

    # calls
    op.create_table(
        'calls',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(500), nullable=True),
        sa.Column('customer_name', sa.String(255), nullable=True),
        sa.Column('customer_company', sa.String(255), nullable=True),
        sa.Column('attendees', postgresql.JSONB(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('audio_s3_key', sa.String(500), nullable=True),
        sa.Column('audio_file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(30), server_default='uploading'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('processing_started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processing_completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_calls_workspace_status', 'calls', ['workspace_id', 'status'])
    op.create_index('idx_calls_created', 'calls', ['workspace_id', 'created_at'])

    # transcripts
    op.create_table(
        'transcripts',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('call_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('full_text', sa.Text(), nullable=False),
        sa.Column('segments', postgresql.JSONB(), nullable=True),
        sa.Column('word_count', sa.Integer(), nullable=True),
        sa.Column('language', sa.String(10), server_default='en'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['call_id'], ['calls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_id'),
    )

    # call_insights
    op.create_table(
        'call_insights',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('call_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('meeting_summary', sa.Text(), nullable=True),
        sa.Column('sentiment', sa.String(20), nullable=True),
        sa.Column('sentiment_reasoning', sa.Text(), nullable=True),
        sa.Column('budget', sa.Text(), nullable=True),
        sa.Column('authority', postgresql.JSONB(), nullable=True),
        sa.Column('need', postgresql.JSONB(), nullable=True),
        sa.Column('timeline', sa.Text(), nullable=True),
        sa.Column('customer_goals', postgresql.JSONB(), nullable=True),
        sa.Column('competitors_mentioned', postgresql.JSONB(), nullable=True),
        sa.Column('objections', postgresql.JSONB(), nullable=True),
        sa.Column('decision_makers', postgresql.JSONB(), nullable=True),
        sa.Column('next_actions_internal', postgresql.JSONB(), nullable=True),
        sa.Column('next_actions_external', postgresql.JSONB(), nullable=True),
        sa.Column('email_followup_subject', sa.String(500), nullable=True),
        sa.Column('email_followup_body', sa.Text(), nullable=True),
        sa.Column('tags', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('raw_llm_response', postgresql.JSONB(), nullable=True),
        sa.Column('llm_model', sa.String(50), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['call_id'], ['calls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_id'),
    )

    # crm_syncs
    op.create_table(
        'crm_syncs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('call_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('provider', sa.String(30), nullable=False),
        sa.Column('contact_id', sa.String(100), nullable=True),
        sa.Column('company_id', sa.String(100), nullable=True),
        sa.Column('deal_id', sa.String(100), nullable=True),
        sa.Column('note_id', sa.String(100), nullable=True),
        sa.Column('task_ids', postgresql.JSONB(), nullable=True),
        sa.Column('deal_stage_before', sa.String(100), nullable=True),
        sa.Column('deal_stage_after', sa.String(100), nullable=True),
        sa.Column('synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('sync_error', sa.Text(), nullable=True),
        sa.Column('is_applied', sa.Boolean(), server_default='false'),
        sa.ForeignKeyConstraint(['call_id'], ['calls.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_id'),
    )

    # integrations
    op.create_table(
        'integrations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('provider', sa.String(50), nullable=False),
        sa.Column('access_token', sa.Text(), nullable=True),
        sa.Column('refresh_token', sa.Text(), nullable=True),
        sa.Column('token_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('scope', sa.String(500), nullable=True),
        sa.Column('external_account_id', sa.String(200), nullable=True),
        sa.Column('external_account_email', sa.String(255), nullable=True),
        sa.Column('meta', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_integration_workspace_provider', 'integrations', ['workspace_id', 'provider'], unique=True)


def downgrade() -> None:
    op.drop_table('integrations')
    op.drop_table('crm_syncs')
    op.drop_table('call_insights')
    op.drop_table('transcripts')
    op.drop_table('calls')
    op.drop_table('workspace_settings')
    op.drop_table('workspace_members')
    op.drop_table('users')
    op.drop_table('workspaces')
