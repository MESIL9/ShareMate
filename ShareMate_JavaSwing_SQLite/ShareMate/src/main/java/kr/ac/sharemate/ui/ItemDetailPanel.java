package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.Item;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.io.File;

public class ItemDetailPanel extends JPanel {
    public ItemDetailPanel(MainFrame app,Item item,Runnable back){
        super(new BorderLayout());setBackground(Theme.WHITE);add(Theme.header("상품 상세",back),BorderLayout.NORTH);
        JPanel body=Theme.paddedColumn(0,18,18,18);
        JLabel photo=new JLabel(item.rent?"📚":"🔄",SwingConstants.CENTER);photo.setOpaque(true);photo.setBackground(Theme.BG);photo.setPreferredSize(new Dimension(380,230));photo.setFont(new Font("Dialog",Font.PLAIN,65));
        if(item.imagePath!=null&&!item.imagePath.isBlank()&&new File(item.imagePath).exists()){photo.setText("");photo.setIcon(new ImageIcon(new ImageIcon(item.imagePath).getImage().getScaledInstance(380,230,Image.SCALE_SMOOTH)));}
        body.add(photo);body.add(Box.createVerticalStrut(18));
        body.add(Theme.label((item.rent?"대여":"물물교환")+"  ·  "+item.category+"  ·  "+item.location,12,true,Theme.BLUE));
        body.add(Box.createVerticalStrut(8));body.add(Theme.label(item.title,22,true,Theme.TEXT));body.add(Box.createVerticalStrut(10));
        body.add(Theme.label(item.rent?"대여비  "+String.format("%,d원",item.price)+"     보증금  "+String.format("%,d원",item.deposit):"교환 희망  "+item.want,16,true,Theme.TEXT));
        body.add(Box.createVerticalStrut(16));body.add(Theme.label("상품 설명",15,true,Theme.TEXT));body.add(Box.createVerticalStrut(6));
        JTextArea desc=new JTextArea(item.description);desc.setEditable(false);desc.setLineWrap(true);desc.setWrapStyleWord(true);desc.setFont(new Font("Malgun Gothic",Font.PLAIN,13));desc.setBackground(Theme.WHITE);body.add(desc);
        body.add(Box.createVerticalStrut(16));body.add(Theme.label("판매자  "+item.owner+"  ·  충남대학교",12,false,Theme.MUTED));
        add(Theme.scroll(body),BorderLayout.CENTER);
        JPanel bottom=new JPanel(new BorderLayout(8,0));bottom.setBorder(new EmptyBorder(10,16,12,16));bottom.setBackground(Theme.WHITE);
        JButton favorite=Theme.ghost(item.favorite?"♥ 찜 취소":"♡ 찜하기",()->{app.items.toggleFavorite(item.id);app.showDetail(item.id,back);});
        bottom.add(favorite,BorderLayout.WEST);bottom.add(Theme.button(item.rent?"채팅 문의":"교환 문의",()->app.showChat(item.id,back)),BorderLayout.CENTER);add(bottom,BorderLayout.SOUTH);
    }
}
