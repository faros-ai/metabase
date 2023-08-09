(ns metabase.driver.duckdb
  (:require [clojure.java.jdbc :as jdbc]
            [honeysql.core :as hsql]
            [medley.core :as m]
            [metabase.driver :as driver]
            [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
            [metabase.driver.sql-jdbc.execute :as sql-jdbc.execute]
            [metabase.driver.sql-jdbc.sync :as sql-jdbc.sync]
            [metabase.driver.sql.query-processor :as sql.qp]
            [metabase.driver.sql.util.unprepare :as unprepare]
            [metabase.util.honeysql-extensions :as hx])
  (:import [java.sql Statement ResultSet ResultSetMetaData Types]))

(driver/register! :duckdb, :parent :sql-jdbc)

(defmethod sql-jdbc.conn/connection-details->spec :duckdb
  [_ {:keys [database_file, read_only, temp_directory, memory_limit], :as details}]
  (let [conn_details (merge
    {:classname         "org.duckdb.DuckDBDriver"
     :subprotocol       "duckdb"
     :subname           (or database_file "")
     "duckdb.read_only" (str read_only)
     "enable_external_access" "false"
     "lock_configuration" "true"}
    (when (not-empty temp_directory)
      {"temp_directory" temp_directory})
    (when (not-empty memory_limit)
      {"memory_limit" memory_limit}))]
    conn_details))

(def ^:private database-type->base-type
  (sql-jdbc.sync/pattern-based-database-type->base-type
   [[#"BOOLEAN"     :type/Boolean]
    [#"BOOL"        :type/Boolean]
    [#"LOGICAL"     :type/Boolean]
    [#"HUGEINT"     :type/BigInteger]
    [#"BIGINT"      :type/BigInteger]
    [#"UBIGINT"     :type/BigInteger]
    [#"INT8"        :type/BigInteger]
    [#"LONG"        :type/BigInteger]
    [#"INT"         :type/Integer]
    [#"INTEGER"     :type/Integer]
    [#"INT4"        :type/Integer]
    [#"SIGNED"      :type/Integer]
    [#"SMALLINT"    :type/Integer]
    [#"INT2"        :type/Integer]
    [#"SHORT"       :type/Integer]
    [#"TINYINT"     :type/Integer]
    [#"INT1"        :type/Integer]
    [#"UINTEGER"    :type/Integer]
    [#"USMALLINT"   :type/Integer]
    [#"UTINYINT"    :type/Integer]
    [#"DECIMAL"     :type/Decimal]
    [#"DOUBLE"      :type/Float]
    [#"FLOAT8"      :type/Float]
    [#"NUMERIC"     :type/Float]
    [#"REAL"        :type/Float]
    [#"FLOAT4"      :type/Float]
    [#"FLOAT"       :type/Float]
    [#"VARCHAR"     :type/Text]
    [#"CHAR"        :type/Text]
    [#"BPCHAR"      :type/Text]
    [#"TEXT"        :type/Text]
    [#"STRING"      :type/Text]
    [#"BLOB"        :type/*]
    [#"BYTEA"       :type/*]
    [#"BINARY"      :type/*]
    [#"VARBINARY"   :type/*]
    [#"UUID"        :type/UUID]
    [#"TIMESTAMP"   :type/DateTime]
    [#"DATETIME"    :type/DateTime]
    [#"TIMESTAMPTZ" :type/DateTimeWithZoneOffset]
    [#"DATE"        :type/Date]
    [#"TIME"        :type/Time]]))

(defmethod sql-jdbc.sync/database-type->base-type :duckdb
  [_ field-type]
  (database-type->base-type field-type))

;; .getObject of DuckDB (v0.4.0) does't handle the java.time.LocalDate but sql.Date only,
;; so get the sql.Date from DuckDB and convert it to java.time.LocalDate
(defmethod sql-jdbc.execute/read-column-thunk [:duckdb Types/DATE]
  [_ ^ResultSet rs _ ^Integer i]
  (fn []
    (let [sqlDate (.getObject rs i java.sql.Date)] (.toLocalDate sqlDate))))

;; .getObject of DuckDB (v0.4.0) does't handle the java.time.LocalTime but sql.Time only,
;; so get the sql.Time from DuckDB and convert it to java.time.LocalTime
(defmethod sql-jdbc.execute/read-column-thunk [:duckdb Types/TIME]
  [_ ^ResultSet rs _ ^Integer i]
  (fn []
    (let [sqlTime (.getObject rs i java.sql.Time)] (.toLocalTime sqlTime))))

;; date processing for aggregation

(defmethod driver/db-start-of-week :duckdb [_] :monday)

(defmethod sql.qp/add-interval-honeysql-form :duckdb
  [driver hsql-form amount unit]
  (condp = unit
    :quarter (recur driver hsql-form (* amount 3) :month)
    :week (recur driver hsql-form (* amount 7) :day)
    (hx/+ (hx/->timestamp hsql-form) (hsql/raw (format "(INTERVAL '%d' %s)" (int amount) (name unit))))))

(defn- date-sub [unit a b] (hx/call :date_sub (hx/literal unit) a b))
(defn- date-trunc [unit x] (hx/call :date_trunc (hx/literal unit) x))

(defmethod sql.qp/date [:duckdb :default]         [_ _ expr] expr)
(defmethod sql.qp/date [:duckdb :minute]          [_ _ expr] (date-trunc :minute expr))
(defmethod sql.qp/date [:duckdb :minute-of-hour]  [_ _ expr] (hsql/call :minute expr))
(defmethod sql.qp/date [:duckdb :hour]            [_ _ expr] (date-trunc :hour expr))
(defmethod sql.qp/date [:duckdb :hour-of-day]     [_ _ expr] (hsql/call :hour expr))
(defmethod sql.qp/date [:duckdb :day]             [_ _ expr] (date-trunc :day expr))
(defmethod sql.qp/date [:duckdb :day-of-month]    [_ _ expr] (hsql/call :day expr))
(defmethod sql.qp/date [:duckdb :day-of-year]     [_ _ expr] (hsql/call :dayofyear expr))

(defmethod sql.qp/date [:duckdb :day-of-week]
  [_ _ expr]
  (sql.qp/adjust-day-of-week :duckdb (hsql/call :dayofweek expr)))

(defmethod sql.qp/date [:duckdb :week]
  [_ _ expr]
  (sql.qp/adjust-start-of-week :duckdb (partial date-trunc :week) expr))

(defmethod sql.qp/date [:duckdb :month]           [_ _ expr] (date-trunc :month expr))
(defmethod sql.qp/date [:duckdb :month-of-year]   [_ _ expr] (hsql/call :month expr))
(defmethod sql.qp/date [:duckdb :quarter]         [_ _ expr] (date-trunc :quarter expr))
(defmethod sql.qp/date [:duckdb :quarter-of-year] [_ _ expr] (hsql/call :quarter expr))
(defmethod sql.qp/date [:duckdb :year]            [_ _ expr] (date-trunc :year expr))

(defmethod sql.qp/datetime-diff [:duckdb :year]    [_driver _unit x y] (date-sub :year x y))
(defmethod sql.qp/datetime-diff [:duckdb :quarter] [_driver _unit x y] (date-sub :quarter x y))
(defmethod sql.qp/datetime-diff [:duckdb :month]   [_driver _unit x y] (date-sub :month x y))
(defmethod sql.qp/datetime-diff [:duckdb :week]    [_driver _unit x y] (date-sub :week x y))
(defmethod sql.qp/datetime-diff [:duckdb :day]     [_driver _unit x y] (date-sub :day x y))
(defmethod sql.qp/datetime-diff [:duckdb :hour]    [_driver _unit x y] (date-sub :hour x y))
(defmethod sql.qp/datetime-diff [:duckdb :minute]  [_driver _unit x y] (date-sub :minute x y))
(defmethod sql.qp/datetime-diff [:duckdb :second]  [_driver _unit x y] (date-sub :second x y))

(defmethod sql.qp/unix-timestamp->honeysql [:duckdb :seconds]
  [_ _ expr]
  (hsql/call :from_unixtime expr))

(defmethod sql.qp/->honeysql [:duckdb :regex-match-first]
  [driver [_ arg pattern]]
  (hsql/call :regexp_extract (sql.qp/->honeysql driver arg) pattern))

;; Handle empty result set
(defn empty-rs [_] ;
  (reify
    ResultSet
    (getMetaData [_]
      (reify
        ResultSetMetaData
        (getColumnCount [_] 1)
        (getColumnLabel [_ _idx] "WARNING")
        (getColumnTypeName [_ _] "CHAR")
        (getColumnType [_ _] Types/CHAR)))
    (next [_] false)
    (close [_])))

;; Override native execute-statement! to handle queries without result set
(defmethod sql-jdbc.execute/execute-statement! :sql-jdbc
  [_driver ^Statement stmt ^String sql]
  (if (.execute stmt sql)
    (.getResultSet stmt)
    (empty-rs [])))

(defmethod driver/describe-database :duckdb
  [_ database]
  {:tables
    (with-open [conn (jdbc/get-connection (sql-jdbc.conn/db->pooled-connection-spec database))]
      (set
        (for [
          {:keys [table_schema table_name]}
          (jdbc/query {:connection conn}
          ["select * from information_schema.tables"])
        ]
          {:name table_name :schema table_schema})))})

(defmethod driver/describe-table :duckdb
  [_ database {table_name :name, schema :schema}]
  {:name   table_name
   :schema schema
   :fields
   (with-open [conn (jdbc/get-connection (sql-jdbc.conn/db->pooled-connection-spec database))]
     (let [results (jdbc/query
                    {:connection conn}
                    [(format "select * from information_schema.columns where table_name = '%s'" table_name)])]
       (set
        (for [[idx {column_name :column_name, data_type :data_type}] (m/indexed results)]
          {:name              column_name
           :database-type     data_type
           :base-type         (sql-jdbc.sync/database-type->base-type :duckdb (keyword data_type))
           :database-position idx}))))})

;; The DuckDB JDBC driver does not support foreign keys yet
(defmethod driver/describe-table-fks :duckdb
  [_ _ _]
  (set #{}))

; Unprepare query since the JDBC driver can't seem to infer column types when select
; contains parameters. Pulled from the Athena driver, which does the same thing.
(defn- unprepare-query [driver {query :native, :as outer-query}]
  (cond-> outer-query
    (seq (:params query))
    (merge {:native {:params nil
                     :query (unprepare/unprepare driver (cons (:query query) (:params query)))}})))

; Override so we can unprepare the query
(defmethod driver/execute-reducible-query :duckdb
  [driver query context respond]
  ((get-method driver/execute-reducible-query :sql-jdbc) driver (unprepare-query driver, query) context respond))
