(ns metabase.driver.duckdb-test
  (:require
   [clojure.java.io :as io]
   [clojure.java.jdbc :as jdbc]
   [clojure.test :refer :all]
   [metabase.driver :as driver]
   [metabase.driver.sql-jdbc.connection :as sql-jdbc.conn]
   [metabase.driver.sql.query-processor-test-util :as sql.qp-test-util]
   [metabase.models.database :refer [Database]]
   [metabase.models.table :refer [Table]]
   [metabase.query-processor :as qp]
   [metabase.query-processor-test :as qp.test]
   [metabase.sync :as sync]
   [metabase.test :as mt]
   [metabase.test.data :as data]
   [metabase.util :as u]
   [toucan.db :as db]
   [toucan.hydrate :refer [hydrate]]))

(defn- test-string-extract
  [expr & [filter]]
  (->> {:expressions {"test" expr}
        :fields      [[:expression "test"]]
        ;; filter clause is optional
        :filter      filter
        ;; To ensure stable ordering
        :order-by    [[:asc [:field (data/id :venues :id) nil]]]
        :limit       1}
       (mt/run-mbql-query venues)
       mt/rows
       ffirst))

(deftest timezone-id-test
  (mt/test-driver :duckdb
    (is (= nil
           (driver/db-default-timezone :duckdb (mt/db))))))

(deftest filter-by-date-test
  (testing "Make sure filtering against a LocalDate works correctly in DuckDB"
    (mt/test-driver :duckdb
      (is (= [[225 "2014-03-04T00:00:00Z"]
              [409 "2014-03-05T00:00:00Z"]
              [917 "2014-03-05T00:00:00Z"]
              [995 "2014-03-05T00:00:00Z"]
              [159 "2014-03-06T00:00:00Z"]
              [951 "2014-03-06T00:00:00Z"]]
             (qp.test/rows
              (data/run-mbql-query checkins
                {:fields   [$id $date]
                 :filter   [:and
                            [:>= $date "2014-03-04"]
                            [:<= $date "2014-03-06"]]
                 :order-by [[:asc $date]]}))
             (qp.test/rows
              (data/run-mbql-query checkins
                {:fields   [$id $date]
                 :filter   [:between $date "2014-03-04" "2014-03-07"]
                 :order-by [[:asc $date]]})))))))

(deftest regex-match-first-escaping-test
  (testing "We escape ? in regular expressions"
    (mt/test-driver :duckdb
      (is (= "Taylor's" (test-string-extract
                         [:regex-match-first [:field (data/id :venues :name) nil] "^Taylor's"]
                         [:= [:field (data/id :venues :name) nil] "Taylor's Prime Steak House"]))))))
