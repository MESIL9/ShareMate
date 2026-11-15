package kr.ac.sharemate.ui;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

public class HomePanel extends JPanel {
    public HomePanel(MainFrame app){
        super(new BorderLayout());setBackground(Theme.WHITE);
        JPanel p=Theme.paddedColumn(30,22,24,22);
        p.add(Theme.label("가까운 이웃과 더 가볍게",13,true,Theme.BLUE));
        p.add(Box.createVerticalStrut(5));p.add(Theme.label("쉐어메이트",29,true,Theme.TEXT));
        p.add(Box.createVerticalStrut(18));
        JTextField search=new JTextField();search.setFont(new Font("Malgun Gothic",Font.PLAIN,14));search.setBorder(new EmptyBorder(13,14,13,14));
        JPanel searchBox=new JPanel(new BorderLayout());searchBox.setBackground(Theme.BG);searchBox.setBorder(BorderFactory.createLineBorder(Theme.LINE));searchBox.add(new JLabel("⌕  "),BorderLayout.WEST);searchBox.add(search);
        search.addActionListener(e->app.showList("전체",search.getText()));p.add(searchBox);
        p.add(Box.createVerticalStrut(28));p.add(Theme.label("어떻게 이용할까요?",18,true,Theme.TEXT));p.add(Box.createVerticalStrut(12));
        JPanel modes=new JPanel(new GridLayout(1,2,12,0));modes.setOpaque(false);
        modes.add(modeCard("📚","대여","필요한 물건을 잠시 빌려요",Theme.PALE_YELLOW,()->app.showList("대여","")));
        modes.add(modeCard("🔄","물물교환","필요한 물건과 바꿔요",Theme.PALE_BLUE,()->app.showList("교환","")));
        p.add(modes);p.add(Box.createVerticalStrut(28));p.add(Theme.label("최근 등록된 상품",18,true,Theme.TEXT));p.add(Box.createVerticalStrut(10));
        for(var it:app.items.search("","전체 카테고리","전체",false).stream().limit(3).toList())p.add(new ItemCard(app,it,()->app.showDetail(it.id,app::showHome)));
        add(Theme.scroll(p),BorderLayout.CENTER);
    }
    private JPanel modeCard(String emoji,String title,String sub,Color bg,Runnable r){
        JPanel p=new JPanel();p.setLayout(new BoxLayout(p,BoxLayout.Y_AXIS));p.setBackground(bg);p.setBorder(new EmptyBorder(18,14,18,14));
        JButton b=Theme.ghost(emoji+"  "+title,r);b.setFont(new Font("Malgun Gothic",Font.BOLD,17));b.setBorderPainted(false);b.setBackground(bg);b.setAlignmentX(LEFT_ALIGNMENT);
        p.add(b);p.add(Box.createVerticalStrut(8));p.add(Theme.label(sub,11,false,Theme.MUTED));return p;
    }
}
