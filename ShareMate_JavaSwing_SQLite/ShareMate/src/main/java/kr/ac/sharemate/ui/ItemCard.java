package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.Item;
import javax.swing.*;
import javax.swing.border.*;
import java.awt.*;
import java.io.File;

public class ItemCard extends JPanel {
    public ItemCard(MainFrame app,Item item,Runnable open){
        super(new BorderLayout(12,0));setBackground(item.rent?Theme.PALE_YELLOW:Theme.PALE_BLUE);
        setBorder(new CompoundBorder(new LineBorder(Theme.LINE),new EmptyBorder(10,10,10,10)));setMaximumSize(new Dimension(Integer.MAX_VALUE,112));
        JLabel image=new JLabel(item.rent?"📚":"🔄",SwingConstants.CENTER);image.setPreferredSize(new Dimension(88,88));image.setOpaque(true);image.setBackground(new Color(235,238,243));
        if(item.imagePath!=null&&!item.imagePath.isBlank()&&new File(item.imagePath).exists()){
            ImageIcon ic=new ImageIcon(new ImageIcon(item.imagePath).getImage().getScaledInstance(88,88,Image.SCALE_SMOOTH));image.setText("");image.setIcon(ic);
        }else image.setFont(new Font("Dialog",Font.PLAIN,30));
        add(image,BorderLayout.WEST);
        JPanel info=new JPanel();info.setOpaque(false);info.setLayout(new BoxLayout(info,BoxLayout.Y_AXIS));
        info.add(Theme.label(item.rent?String.format("%,d원",item.price):"교환 희망: "+item.want,15,true,Theme.BLUE));
        info.add(Box.createVerticalStrut(5));info.add(Theme.label(item.title,13,true,Theme.TEXT));
        info.add(Theme.label(item.rent?"보증금 "+String.format("%,d원",item.deposit):item.tags,11,false,Theme.MUTED));
        info.add(Theme.label(item.location,11,false,Theme.MUTED));add(info,BorderLayout.CENTER);
        JButton fav=Theme.ghost(item.favorite?"♥":"♡",null);
        fav.setForeground(Theme.BLUE);
        fav.addActionListener(e->{app.items.toggleFavorite(item.id);item.favorite=!item.favorite;fav.setText(item.favorite?"♥":"♡");});
        add(fav,BorderLayout.EAST);
        addMouseListener(new java.awt.event.MouseAdapter(){public void mouseClicked(java.awt.event.MouseEvent e){open.run();}});
        image.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
    }
}
