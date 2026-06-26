-- ============================================================
-- One-off: consolidate 176 imported fabric types into a clean set.
-- Target set: BABYTERRY, FLEECE, WAFFLE BESAR, WAFFLE KECIL, WAFFLE,
--             RIB, JALA, PE SK, MILANO, BRAZIL
-- Production records that match none of these are DELETED.
-- Re-runnable: source of truth is the Excel + import-excel.js.
-- ============================================================
BEGIN;

-- 1. Ensure the 10 target types exist
INSERT INTO fabric_types (name) VALUES
  ('BABYTERRY'), ('FLEECE'), ('WAFFLE BESAR'), ('WAFFLE KECIL'), ('WAFFLE'),
  ('RIB'), ('JALA'), ('PE SK'), ('MILANO'), ('BRAZIL')
ON CONFLICT (name) DO NOTHING;

-- 2. Remap production records to the target type by name pattern.
--    CASE order matters: BESAR/KECIL before generic WAFFLE.
WITH tgt AS (
  SELECT pr.id AS rec_id,
    CASE
      WHEN ft.name ~ 'BBT|BBYT|BABYT|\mBT\M'                  THEN 'BABYTERRY'
      WHEN ft.name ~ 'WAF.*(BESAR|BSR)'                        THEN 'WAFFLE BESAR'
      WHEN ft.name ~ 'WAF.*(KCIL|KECIL)'                       THEN 'WAFFLE KECIL'
      WHEN ft.name ~ 'WAF'                                     THEN 'WAFFLE'
      WHEN ft.name ~ 'FL[EC]|FLEECE|FLC'                       THEN 'FLEECE'
      WHEN ft.name ~ 'RIB'                                     THEN 'RIB'
      WHEN ft.name ~ 'JALA'                                    THEN 'JALA'
      WHEN ft.name ~ 'PE.*SK|^SK|PE ?30|PE30|SK ?30|SK30'      THEN 'PE SK'
      WHEN ft.name ~ 'MILANO'                                  THEN 'MILANO'
      WHEN ft.name ~ 'BRAZIL|BERAZIL'                          THEN 'BRAZIL'
      ELSE NULL
    END AS tname
  FROM production_records pr JOIN fabric_types ft ON ft.id = pr.fabric_type_id
)
UPDATE production_records pr
SET fabric_type_id = nt.id
FROM tgt JOIN fabric_types nt ON nt.name = tgt.tname
WHERE pr.id = tgt.rec_id;

-- 3. Delete production records that mapped to no target type
DELETE FROM production_records
WHERE fabric_type_id NOT IN (
  SELECT id FROM fabric_types WHERE name IN
    ('BABYTERRY','FLEECE','WAFFLE BESAR','WAFFLE KECIL','WAFFLE','RIB','JALA','PE SK','MILANO','BRAZIL')
);

-- 4. Delete all non-target fabric types (now unreferenced)
DELETE FROM fabric_types
WHERE name NOT IN
  ('BABYTERRY','FLEECE','WAFFLE BESAR','WAFFLE KECIL','WAFFLE','RIB','JALA','PE SK','MILANO','BRAZIL');

COMMIT;
