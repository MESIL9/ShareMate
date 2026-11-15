package kr.ac.sharemate.service;

import kr.ac.sharemate.db.Database;
import kr.ac.sharemate.model.Item;
import java.sql.*;
import java.util.*;

public class ItemService {
    private Item map(ResultSet r) throws SQLException {
        return new Item(r.getInt("id"),r.getInt("rent")==1,r.getString("title"),r.getString("category"),
            r.getString("description"),r.getString("want"),r.getString("tags"),r.getString("image_path"),
            r.getString("owner"),r.getString("location"),r.getInt("price"),r.getInt("deposit"),r.getInt("views"),
            r.getInt("favorite")==1,r.getString("created_at"));
    }
    public List<Item> search(String query, String category, String mode, boolean favoritesOnly) {
        List<Item> out=new ArrayList<>();
        String sql="SELECT i.*, CASE WHEN f.item_id IS NULL THEN 0 ELSE 1 END favorite FROM items i LEFT JOIN favorites f ON f.item_id=i.id WHERE 1=1";
        if ("대여".equals(mode)) sql+=" AND i.rent=1";
        if ("교환".equals(mode)) sql+=" AND i.rent=0";
        if (category!=null && !category.equals("전체 카테고리")) sql+=" AND i.category=?";
        if (favoritesOnly) sql+=" AND f.item_id IS NOT NULL";
        if (query!=null && !query.isBlank()) sql+=" AND (i.title LIKE ? OR i.description LIKE ? OR i.tags LIKE ? OR i.want LIKE ?)";
        sql+=" ORDER BY i.id DESC";
        try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement(sql)){
            int n=1;
            if(category!=null&&!category.equals("전체 카테고리"))p.setString(n++,category);
            if(query!=null&&!query.isBlank()){String q="%"+query.trim()+"%";for(int k=0;k<4;k++)p.setString(n++,q);}
            try(ResultSet r=p.executeQuery()){while(r.next())out.add(map(r));}
        }catch(SQLException e){throw new RuntimeException(e);}
        return out;
    }
    public Item get(int id) {
        String sql="SELECT i.*, CASE WHEN f.item_id IS NULL THEN 0 ELSE 1 END favorite FROM items i LEFT JOIN favorites f ON f.item_id=i.id WHERE i.id=?";
        try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement(sql)){p.setInt(1,id);try(ResultSet r=p.executeQuery()){return r.next()?map(r):null;}}
        catch(SQLException e){throw new RuntimeException(e);}
    }
    public void create(boolean rent,String title,String category,String desc,String want,String tags,String image,int price,int deposit){
        String sql="INSERT INTO items(rent,title,category,description,want,tags,image_path,owner,price,deposit) VALUES(?,?,?,?,?,?,?,'나',?,?)";
        try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement(sql)){
            p.setInt(1,rent?1:0);p.setString(2,title);p.setString(3,category);p.setString(4,desc);p.setString(5,want);
            p.setString(6,tags);p.setString(7,image);p.setInt(8,price);p.setInt(9,deposit);p.executeUpdate();
        }catch(SQLException e){throw new RuntimeException(e);}
    }
    public void toggleFavorite(int id){
        try(Connection c=Database.connect()){
            boolean exists;try(PreparedStatement q=c.prepareStatement("SELECT 1 FROM favorites WHERE item_id=?")){q.setInt(1,id);try(ResultSet r=q.executeQuery()){exists=r.next();}}
            try(PreparedStatement p=c.prepareStatement(exists?"DELETE FROM favorites WHERE item_id=?":"INSERT INTO favorites(item_id) VALUES(?)")){p.setInt(1,id);p.executeUpdate();}
        }catch(SQLException e){throw new RuntimeException(e);}
    }
    public void incrementViews(int id){try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement("UPDATE items SET views=views+1 WHERE id=?")){p.setInt(1,id);p.executeUpdate();}catch(SQLException e){throw new RuntimeException(e);}}
    public List<Item> myItems(){return search("","전체 카테고리","전체",false).stream().filter(i->"나".equals(i.owner)).toList();}
}
