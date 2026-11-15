package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.Item;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

public class ChatListPanel extends JPanel {
    public ChatListPanel(MainFrame app){
        super(new BorderLayout());setBackground(Theme.WHITE);
        JPanel list=Theme.paddedColumn(18,16,16,16);list.add(Theme.label("채팅",23,true,Theme.TEXT));list.add(Box.createVerticalStrut(12));
        var ids=app.chats.chatItemIds();if(ids.isEmpty())list.add(Theme.label("아직 채팅이 없어요. 상품에서 채팅 문의를 시작해 보세요.",12,false,Theme.MUTED));
        for(int id:ids){Item it=app.items.get(id);if(it==null)continue;var msgs=app.chats.messages(id);String last=msgs.isEmpty()?"대화를 시작해 보세요":msgs.get(msgs.size()-1).content;
            JButton row=Theme.ghost(it.owner+"  ·  "+it.title+"\n"+last,()->app.showChat(id,app::showChats));row.setHorizontalAlignment(SwingConstants.LEFT);row.setMaximumSize(new Dimension(Integer.MAX_VALUE,66));row.setAlignmentX(LEFT_ALIGNMENT);list.add(row);list.add(Box.createVerticalStrut(6));}
        add(Theme.scroll(list),BorderLayout.CENTER);
    }
}
