CREATE TABLE users (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE
);
CREATE TABLE products (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT NOT NULL
);
CREATE TABLE voucher_balances (
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL CHECK (quantity BETWEEN 0 AND 1000000),
    PRIMARY KEY (user_id, product_id)
);
CREATE TABLE activations (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    activated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX activations_user_history ON activations(user_id, activated_at DESC, id DESC);

INSERT INTO users (name, email) VALUES
('Александр Волков', 'alexander@example.com'),
('Мария Ким', 'maria@example.com'),
('Данияр Асанов', 'daniyar@example.com');
INSERT INTO products (name, description, category) VALUES
('Stage 1', 'Программная настройка двигателя для уверенной динамики каждый день.', 'ECU TUNING'),
('Stage 2', 'Расширенная настройка двигателя с учётом доработок автомобиля.', 'PERFORMANCE'),
('DSG Tuning', 'Настройка трансмиссии: быстрые переключения и точный отклик.', 'TRANSMISSION'),
('Диагностика', 'Комплексная проверка электронных систем автомобиля.', 'DIAGNOSTICS');
INSERT INTO voucher_balances (user_id, product_id, quantity) VALUES
(1, 1, 5), (1, 2, 2), (1, 3, 0), (1, 4, 8),
(2, 1, 3), (2, 3, 2), (3, 4, 1);
