import psycopg2

url = open(r"d:\desktop\Desktop-application-Multiple-System\local\live-database.url").read().strip()
conn = psycopg2.connect(url)
cur = conn.cursor()

print("=== menu items named like handi ===")
cur.execute(
    """
    SELECT m.id, m.name, m.portion, b.name AS branch, m.created_at
    FROM pops_menu_items m
    JOIN pops_branches b ON b.id = m.branch_id
    WHERE m.name ILIKE '%handi%'
    ORDER BY b.name, m.name
    """
)
for row in cur.fetchall():
    print(row)

print("=== recipes named like handi ===")
cur.execute(
    """
    SELECT r.id, r.name, r.menu_item_id, r.portion_size, r.active,
           (SELECT count(*) FROM pops_recipe_lines l WHERE l.recipe_id = r.id) AS lines,
           m.name AS menu_name, b.name AS branch
    FROM pops_recipes r
    LEFT JOIN pops_menu_items m ON m.id = r.menu_item_id
    JOIN pops_branches b ON b.id = r.branch_id
    WHERE r.name ILIKE '%handi%' OR m.name ILIKE '%handi%'
    ORDER BY r.created_at
    """
)
for row in cur.fetchall():
    print(row)

print("=== variants for those menu items ===")
cur.execute(
    """
    SELECT v.id, v.menu_item_id, v.label, v.price, v.is_active, m.name
    FROM pops_menu_item_variants v
    JOIN pops_menu_items m ON m.id = v.menu_item_id
    WHERE m.name ILIKE '%handi%'
    ORDER BY m.name, v.label
    """
)
for row in cur.fetchall():
    print(row)

conn.close()
