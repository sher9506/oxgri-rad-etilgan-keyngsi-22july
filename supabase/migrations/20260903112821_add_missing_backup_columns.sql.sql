-- ustoz: backup'dagi yetishmayotgan ustunlar
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS password_hash text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS parol_hash text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS face_image text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS note text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS karta_tur text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS karta_egasi text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS telegram_username text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS otp_kod text;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS otp_expires timestamptz;
ALTER TABLE ustoz ADD COLUMN IF NOT EXISTS telegram_chat_id text;

-- talabalar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS user_id text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS fraud_flag boolean DEFAULT false;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS parol_hash text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS telegram_chat_id text;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS total_xp integer DEFAULT 0;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS current_level integer DEFAULT 0;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS badges jsonb DEFAULT '[]';
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS xp_streak integer DEFAULT 0;
ALTER TABLE talabalar ADD COLUMN IF NOT EXISTS last_xp_date timestamptz;

-- testlar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS kod text;
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS ustoz_ismi text;
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS allow_retake boolean DEFAULT true;
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS ommaviy boolean DEFAULT false;
ALTER TABLE testlar ADD COLUMN IF NOT EXISTS narx numeric DEFAULT 0;

-- toplamlar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE toplamlar ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE toplamlar ADD COLUMN IF NOT EXISTS ommaviy boolean DEFAULT false;
ALTER TABLE toplamlar ADD COLUMN IF NOT EXISTS narx numeric DEFAULT 0;

-- test_sessiyalar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE test_sessiyalar ADD COLUMN IF NOT EXISTS sessiya_turi text;
ALTER TABLE test_sessiyalar ADD COLUMN IF NOT EXISTS ruxsatli_oquvchilar jsonb DEFAULT '[]';
ALTER TABLE test_sessiyalar ADD COLUMN IF NOT EXISTS faol boolean DEFAULT true;
ALTER TABLE test_sessiyalar ADD COLUMN IF NOT EXISTS expires_at timestamptz;

-- javoblar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE javoblar ADD COLUMN IF NOT EXISTS javoblar jsonb;
ALTER TABLE javoblar ADD COLUMN IF NOT EXISTS baho text;

-- om_korishlar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE om_korishlar ADD COLUMN IF NOT EXISTS bolim_id text;

-- sj_bolimlar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE sj_bolimlar ADD COLUMN IF NOT EXISTS ustoz_id text;
ALTER TABLE sj_bolimlar ADD COLUMN IF NOT EXISTS ustoz_ismi text;
ALTER TABLE sj_bolimlar ADD COLUMN IF NOT EXISTS narx numeric DEFAULT 0;

-- sj_boblar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE sj_boblar ADD COLUMN IF NOT EXISTS parent_bob_id text;

-- sj_savollar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE sj_savollar ADD COLUMN IF NOT EXISTS link text;
ALTER TABLE sj_savollar ADD COLUMN IF NOT EXISTS tartib integer DEFAULT 0;

-- sj_natijalar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE sj_natijalar ADD COLUMN IF NOT EXISTS bolim_id text;
ALTER TABLE sj_natijalar ADD COLUMN IF NOT EXISTS bob_id text;
ALTER TABLE sj_natijalar ADD COLUMN IF NOT EXISTS natija text;
ALTER TABLE sj_natijalar ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- settings: backup'dagi yetishmayotgan ustunlar
ALTER TABLE settings ADD COLUMN IF NOT EXISTS value text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS tavsif text;
ALTER TABLE settings ADD COLUMN IF NOT EXISTS user_id text;

-- yangiliklar: backup'dagi yetishmayotgan ustunlar
ALTER TABLE yangiliklar ADD COLUMN IF NOT EXISTS manba text;
ALTER TABLE yangiliklar ADD COLUMN IF NOT EXISTS user_id text;