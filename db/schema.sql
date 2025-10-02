CREATE TABLE IF NOT EXISTS ideas (
                                     id SERIAL PRIMARY KEY,
                                     title TEXT NOT NULL,
                                     description TEXT,
                                     created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

CREATE TABLE IF NOT EXISTS votes (
                                     id SERIAL PRIMARY KEY,
                                     idea_id INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
    ip_address VARCHAR(100) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (idea_id, ip_address)
    );

CREATE INDEX IF NOT EXISTS idx_votes_ip ON votes(ip_address);
CREATE INDEX IF NOT EXISTS idx_votes_idea ON votes(idea_id);
