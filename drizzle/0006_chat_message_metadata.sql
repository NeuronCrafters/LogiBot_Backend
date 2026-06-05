ALTER TABLE "chat_messages" ADD COLUMN "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
