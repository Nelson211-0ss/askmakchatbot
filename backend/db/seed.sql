INSERT INTO users (full_name, email, password_hash, role, email_verified)
VALUES (
    'AskMak Admin',
    'admin@mak.ac.ug',
    '$2b$12$z9/SZUPcvv88sEzHOk16Oel.NdSlaRSBRSZocYy.cxUjeMrBmQrNS',
    'admin',
    TRUE
) ON CONFLICT (email) DO NOTHING;
