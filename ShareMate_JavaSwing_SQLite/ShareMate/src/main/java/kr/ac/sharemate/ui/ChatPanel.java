package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.*;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

public class ChatPanel extends JPanel {
    public ChatPanel(MainFrame app,int itemId,Runnable back){
        super(new BorderLayout());Item item=app.items.get(itemId);setBackground(Theme.WHITE);
        JPanel top=new JPanel(new BorderLayout());top.setBackground(Theme.WHITE);
        top.add(Theme.header(item==null?"채팅":item.owner,back),BorderLayout.NORTH);
        JPanel summary=new JPanel(new BorderLayout());summary.setBackground(Theme.BG);summary.setBorder(new EmptyBorder(10,14,10,14));
        summary.add(Theme.label(item==null?"상품 정보":"상품  "+item.title,13,true,Theme.TEXT));top.add(summary,BorderLayout.SOUTH);
        add(top,BorderLayout.NORTH);
        JPanel messages=Theme.column();messages.setBorder(new EmptyBorder(12,12,12,12));JScrollPane scroll=Theme.scroll(messages);add(scroll,BorderLayout.CENTER);
        Runnable render=()->{messages.removeAll();for(Message m:app.chats.messages(itemId))messages.add(bubble(m));messages.revalidate();messages.repaint();SwingUtilities.invokeLater(()->scroll.getVerticalScrollBar().setValue(scroll.getVerticalScrollBar().getMaximum()));};
        render.run();
        JTextField input=new JTextField();input.setFont(new Font("Malgun Gothic",Font.PLAIN,14));input.setBorder(new EmptyBorder(10,10,10,10));
        Runnable send=()->{String t=input.getText().trim();if(t.isEmpty())return;app.chats.send(itemId,true,t);input.setText("");render.run();Timer timer=new Timer(800,e->{app.chats.send(itemId,false,app.chats.autoReply(t));render.run();});timer.setRepeats(false);timer.start();};
        input.addActionListener(e->send.run());JPanel bar=new JPanel(new BorderLayout(8,0));bar.setBorder(new EmptyBorder(9,10,10,10));bar.setBackground(Theme.WHITE);bar.add(input);bar.add(Theme.button("전송",send),BorderLayout.EAST);add(bar,BorderLayout.SOUTH);
    }
    private JComponent bubble(Message m){
        JPanel row=new JPanel(new FlowLayout(m.mine?FlowLayout.RIGHT:FlowLayout.LEFT,5,5));row.setOpaque(false);
        JTextArea text=new JTextArea(m.content);text.setLineWrap(true);text.setWrapStyleWord(true);text.setEditable(false);text.setColumns(Math.min(24,Math.max(8,m.content.length())));
        text.setBackground(m.mine?Theme.PALE_BLUE:Theme.BG);text.setBorder(new EmptyBorder(8,11,8,11));text.setFont(new Font("Malgun Gothic",Font.PLAIN,13));row.add(text);row.setAlignmentX(LEFT_ALIGNMENT);return row;
    }
}
