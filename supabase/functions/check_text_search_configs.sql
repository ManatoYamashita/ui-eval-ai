-- 利用可能なテキスト検索設定を確認
SELECT cfgname, cfgowner, cfgparser, cfgnamespace 
FROM pg_ts_config 
ORDER BY cfgname;

-- デフォルト設定も確認
SHOW default_text_search_config; 