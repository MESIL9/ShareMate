package kr.ac.sharemate.db;

import java.sql.*;

public final class Database {
    private static final String URL = "jdbc:sqlite:sharemate.db";
    private Database() {}
    public static Connection connect() throws SQLException {
        Connection c = DriverManager.getConnection(URL);
        try (Statement s=c.createStatement()) { s.execute("PRAGMA foreign_keys=ON"); }
        return c;
    }
    public static void initialize() {
        try (Connection c=connect(); Statement s=c.createStatement()) {
            s.executeUpdate("""
                CREATE TABLE IF NOT EXISTS items(
                  id INTEGER PRIMARY KEY AUTOINCREMENT, rent INTEGER NOT NULL, title TEXT NOT NULL,
                  category TEXT NOT NULL, description TEXT, want TEXT, tags TEXT, image_path TEXT,
                  owner TEXT NOT NULL DEFAULT '나', location TEXT NOT NULL DEFAULT '대전 유성구 온천2동',
                  price INTEGER NOT NULL DEFAULT 0, deposit INTEGER NOT NULL DEFAULT 0,
                  views INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )""");
            s.executeUpdate("""
                CREATE TABLE IF NOT EXISTS favorites(
                  item_id INTEGER PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE
                )""");
            s.executeUpdate("""
                CREATE TABLE IF NOT EXISTS messages(
                  id INTEGER PRIMARY KEY AUTOINCREMENT, item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
                  mine INTEGER NOT NULL, content TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )""");
            try (ResultSet rs=s.executeQuery("SELECT COUNT(*) FROM items")) {
                if (rs.next() && rs.getInt(1)==0) seed(c);
            }
        } catch (SQLException e) { throw new RuntimeException("데이터베이스 초기화 실패", e); }
    }
    private static void seed(Connection c) throws SQLException {
        String sql="INSERT INTO items(rent,title,category,description,want,tags,owner,price,deposit) VALUES(?,?,?,?,?,?,?,?,?)";
        try (PreparedStatement p=c.prepareStatement(sql)) {
            addSeed(p,1,"대학글쓰기 교재 대여","책/전공","필기한 부분 외에는 깨끗해요","","#교재 #글쓰기","홍길동",4000,12000);
            addSeed(p,1,"창의적 글쓰기 교재 대여 희망","책/전공","한 학기 동안 사용할 교재를 찾고 있어요","","#교재","김학생",4000,0);
            addSeed(p,0,"바이오 그릭요거트","음식/유제품","유통기한 여유 있어요","아무거나 좋아요","#음식","박학생",0,0);
            addSeed(p,0,"모짜렐라 치즈 5개","음식/유제품","과일과 교환하고 싶어요","과일류","#과일 #음식","이학생",0,0);
            p.executeBatch();
        }
    }
    private static void addSeed(PreparedStatement p,int rent,String title,String cat,String desc,String want,String tags,String owner,int price,int dep)throws SQLException{
        p.setInt(1,rent);p.setString(2,title);p.setString(3,cat);p.setString(4,desc);p.setString(5,want);p.setString(6,tags);p.setString(7,owner);p.setInt(8,price);p.setInt(9,dep);p.addBatch();
    }
}
