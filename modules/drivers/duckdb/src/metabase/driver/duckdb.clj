(ns metabase.driver.duckdb
  (:require [metabase.config :as config]
            [metabase.driver :as driver]
            [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
            [metabase.driver.sql-jdbc.execute :as sql-jdbc.execute]
            [metabase.driver.sql-jdbc.sync :as sql-jdbc.sync]
            [metabase.driver.sql.query-processor :as sql.qp]
            [metabase.util.honeysql-extensions :as hx])
  (:import [java.sql ResultSet Types]))

(set! *warn-on-reflection* true)

(driver/register! :duckdb, :parent :sql-jdbc)

;;
;; Base driver configuration
;;

(defmethod driver/supports? [:duckdb :actions] [_ _] false)
(defmethod driver/supports? [:duckdb :actions/custom] [_ _] false)
(defmethod driver/supports? [:duckdb :datetime-diff] [_ _] true)
(defmethod driver/supports? [:duckdb :foreign-keys] [_ _] (not config/is-test?))
(defmethod driver/supports? [:duckdb :now] [_ _] true)
(defmethod driver/supports? [:duckdb :set-timezone] [_ _] false)

;; Matches Postgres driver
(defmethod driver/db-start-of-week :duckdb [_] :monday)

(defmethod sql-jdbc.conn/connection-details->spec :duckdb
  [_driver {:keys [database_file, read_only, temp_directory, memory_limit]}]
  (merge {:classname                  "org.duckdb.DuckDBDriver"
          :subprotocol                "duckdb"
          :subname                    database_file
          "autoload_known_extensions" "false"
          "duckdb.read_only"          (str read_only)
          "enable_external_access"    "false"
          "lock_configuration"        "true"}
         (when (not-empty temp_directory) {"temp_directory" temp_directory})
         (when (not-empty memory_limit) {"memory_limit" memory_limit})))

(defmethod sql-jdbc.conn/data-source-name :duckdb
  [_driver {:keys [database_file]}]
  database_file)

;;
;; Sync metadata
;;

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
  [_driver field-type]
  (database-type->base-type field-type))

;; Override table types. See:
;; https://duckdb.org/docs/sql/information_schema.html#tables-and-views
(defmethod sql-jdbc.sync/table-types :duckdb
  [_driver]
  (into-array String ["BASE TABLE" "VIEW"]))

;; The DuckDB JDBC driver does not implement getImportedKeys()
(defmethod driver/describe-table-fks :duckdb [_ _ _] (set #{}))

;; DuckDB's ResultSet only accepts the old java.sql.Date and java.sql.Time, so convert
;; those to java.time.Date and java.time.Time respectively. Technically, these should
;; be supported by JDBC 4.2 drivers, but DuckDB isn't fully compliant yet.
(defmethod sql-jdbc.execute/read-column-thunk [:duckdb Types/DATE]
  [_ ^ResultSet rs _ ^Integer i]
  (fn []
    (let [sqlDate (.getObject rs i java.sql.Date)] (.toLocalDate sqlDate))))

(defmethod sql-jdbc.execute/read-column-thunk [:duckdb Types/TIME]
  [_ ^ResultSet rs _ ^Integer i]
  (fn []
    (let [sqlTime (.getObject rs i java.sql.Time)] (.toLocalTime sqlTime))))

;;
;; Query processor
;;

(defn- date-part [unit x] (hx/call :date_part (hx/literal unit) x))
(defn- date-trunc [unit x] (hx/call :date_trunc (hx/literal unit) x))
(defn- date-diff [unit a b] (hx/call :date_diff (hx/literal unit) a b))

(defmethod sql.qp/add-interval-honeysql-form :duckdb
  [driver hsql-form amount unit]
  (condp = unit
    :quarter (recur driver hsql-form (* amount 3) :month)
    :week (recur driver hsql-form (* amount 7) :day)
    (hx/+ (hx/->timestamp hsql-form) (hx/raw (format "(INTERVAL '%d' %s)" (int amount) (name unit))))))

(defmethod sql.qp/date [:duckdb :default]         [_ _ expr] expr)
(defmethod sql.qp/date [:duckdb :minute]          [_ _ expr] (date-trunc :minute expr))
(defmethod sql.qp/date [:duckdb :minute-of-hour]  [_ _ expr] (hx/call :minute expr))
(defmethod sql.qp/date [:duckdb :hour]            [_ _ expr] (date-trunc :hour expr))
(defmethod sql.qp/date [:duckdb :hour-of-day]     [_ _ expr] (hx/call :hour expr))
(defmethod sql.qp/date [:duckdb :day]             [_ _ expr] (date-trunc :day expr))
(defmethod sql.qp/date [:duckdb :day-of-month]    [_ _ expr] (hx/call :day expr))
(defmethod sql.qp/date [:duckdb :day-of-year]     [_ _ expr] (hx/call :dayofyear expr))

(defmethod sql.qp/date [:duckdb :day-of-week]
  [_ _ expr]
  (sql.qp/adjust-day-of-week :duckdb (hx/call :dayofweek expr)))

(defmethod sql.qp/date [:duckdb :week]
  [_ _ expr]
  (sql.qp/adjust-start-of-week :duckdb (partial date-trunc :week) expr))

(defmethod sql.qp/date [:duckdb :month]           [_ _ expr] (date-trunc :month expr))
(defmethod sql.qp/date [:duckdb :month-of-year]   [_ _ expr] (hx/call :month expr))
(defmethod sql.qp/date [:duckdb :quarter]         [_ _ expr] (date-trunc :quarter expr))
(defmethod sql.qp/date [:duckdb :quarter-of-year] [_ _ expr] (hx/call :quarter expr))
(defmethod sql.qp/date [:duckdb :year]            [_ _ expr] (date-trunc :year expr))

(defmethod sql.qp/datetime-diff [:duckdb :year]
  [driver _unit x y]
  (hx// (sql.qp/datetime-diff driver :month x y) 12))

(defmethod sql.qp/datetime-diff [:duckdb :quarter]
  [driver _unit x y]
  (hx// (sql.qp/datetime-diff driver :month x y) 3))

(defmethod sql.qp/datetime-diff [:duckdb :month]
  [_driver _unit x y]
  (hx/+ (date-diff :month x y)
        ;; date_diff counts month boundaries not whole months, so we need to adjust
        ;; if x<y but x>y in the month calendar then subtract one month
        ;; if x>y but x<y in the month calendar then add one month
        (hx/call
         :case
         (hx/call :and (hx/call :< x y) (hx/call :> (date-part :day x) (date-part :day y))) -1
         (hx/call :and (hx/call :> x y) (hx/call :< (date-part :day x) (date-part :day y))) 1
         :else 0)))

(defmethod sql.qp/datetime-diff [:duckdb :week] [_driver _unit x y] (hx// (date-diff :day x y) 7))
(defmethod sql.qp/datetime-diff [:duckdb :day] [_driver _unit x y] (date-diff :day x y))
(defmethod sql.qp/datetime-diff [:duckdb :hour] [_driver _unit x y] (hx// (date-diff :millisecond x y) 3600000))
(defmethod sql.qp/datetime-diff [:duckdb :minute] [_driver _unit x y] (date-diff :minute x y))
(defmethod sql.qp/datetime-diff [:duckdb :second] [_driver _unit x y] (date-diff :second x y))

(defmethod sql.qp/unix-timestamp->honeysql [:duckdb :seconds]
  [_ _ expr]
  (hx/call :epoch_ms (hx/cast :bigint (hx/* expr 1000))))

;; Extracts the first group of the match
(defmethod sql.qp/->honeysql [:duckdb :regex-match-first]
  [driver [_ arg pattern]]
  (hx/call :regexp_extract (sql.qp/->honeysql driver arg) (sql.qp/->honeysql driver pattern) 1))
