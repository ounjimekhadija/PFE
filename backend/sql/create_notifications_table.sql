-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- Recipient
    sender_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Who triggered it
    projet_id UUID REFERENCES projets(id) ON DELETE CASCADE, -- Related project
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL, -- 'MESSAGE', 'COMMENT_LIVRABLE', 'COMMENT_TACHE', 'VALIDATION_LIVRABLE', 'VALIDATION_ITERATION', etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own notifications
CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- Policy for service role or authenticated users to insert
CREATE POLICY "Enable insert for authenticated users" ON notifications
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy for users to update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);
