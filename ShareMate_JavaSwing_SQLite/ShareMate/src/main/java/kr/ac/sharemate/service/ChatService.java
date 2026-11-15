package kr.ac.sharemate.service;

import kr.ac.sharemate.db.Database;
import kr.ac.sharemate.model.Message;
import java.sql.*;
import java.util.*;

public class ChatService {
    public List<Message> messages(int itemId){
        List<Message> a=new ArrayList<>();
        try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement("SELECT * FROM messages WHERE item_id=? ORDER BY id")){
            p.setInt(1,itemId);try(ResultSet r=p.executeQuery()){while(r.next())a.add(new Message(r.getInt("id"),itemId,r.getInt("mine")==1,r.getString("content"),r.getString("sent_at")));}
        }catch(SQLException e){throw new RuntimeException(e);}return a;
    }
    public void send(int itemId,boolean mine,String content){
        try(Connection c=Database.connect();PreparedStatement p=c.prepareStatement("INSERT INTO messages(item_id,mine,content) VALUES(?,?,?)")){
            p.setInt(1,itemId);p.setInt(2,mine?1:0);p.setString(3,content);p.executeUpdate();
        }catch(SQLException e){throw new RuntimeException(e);}
    }
    public List<Integer> chatItemIds(){
        List<Integer> a=new ArrayList<>();try(Connection c=Database.connect();Statement s=c.createStatement();ResultSet r=s.executeQuery("SELECT item_id FROM messages GROUP BY item_id ORDER BY MAX(id) DESC")){while(r.next())a.add(r.getInt(1));}catch(SQLException e){throw new RuntimeException(e);}return a;
    }
    public String autoReply(String t){
        if(t.contains("가능"))return "네, 가능해요! 몇 시쯤 오실 수 있으세요?";
        if(t.contains("가격")||t.contains("얼마"))return "게시글에 적힌 가격 그대로예요.";
        if(t.contains("시"))return "좋아요, 그 시간에 교양관 앞에서 만나요 :)";
        return "네, 확인했어요!";
    }
}
