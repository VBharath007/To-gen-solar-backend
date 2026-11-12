declare module 'better-sqlite3' {
  namespace Database {
    interface Database {
      [key: string]: any;
      prepare<T = any>(sql: string): any;
      exec(sql: string): any;
      pragma(pragma: string, options?: any): any;
      transaction(fn: Function): any;
    }
  }
  interface Database extends Database.Database {}
  const Database: {
    new (filename?: string, options?: any): Database.Database;
    (filename?: string, options?: any): Database.Database;
    Database: any;
  };
  export default Database;
}
