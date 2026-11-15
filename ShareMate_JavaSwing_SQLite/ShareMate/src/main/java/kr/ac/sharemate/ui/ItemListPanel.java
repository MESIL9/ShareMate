package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.Item;
import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;

public class ItemListPanel extends JPanel {
    private final MainFrame app;private final String mode;
    private final JTextField search=new JTextField();private final JComboBox<String> category=new JComboBox<>();
    private final JCheckBox favorites=new JCheckBox("♥ 찜한 상품만");
    private final JPanel results=Theme.column();private final JLabel count=Theme.label("",12,false,Theme.MUTED);
    public ItemListPanel(MainFrame app,String mode,String query){
        super(new BorderLayout());this.app=app;this.mode=mode;setBackground(Theme.WHITE);
        JPanel head=Theme.column();head.add(Theme.header(mode.equals("대여")?"대여":mode.equals("교환")?"물물교환":"검색 결과",app::showHome));
        search.setText(query);search.setFont(new Font("Malgun Gothic",Font.PLAIN,14));search.setBorder(new EmptyBorder(12,12,12,12));
        JPanel sb=new JPanel(new BorderLayout());sb.setBackground(Theme.BG);sb.setBorder(new EmptyBorder(6,12,6,12));sb.add(new JLabel("⌕"),BorderLayout.WEST);sb.add(search);head.add(sb);
        category.addItem("전체 카테고리");for(String c:Theme.CATEGORIES)category.addItem(c);
        JPanel filters=new JPanel(new FlowLayout(FlowLayout.LEFT));filters.setOpaque(false);favorites.setOpaque(false);filters.add(category);filters.add(favorites);filters.add(count);head.add(filters);
        add(head,BorderLayout.NORTH);
        JPanel wrap=Theme.paddedColumn(12,16,12,16);wrap.add(results);add(Theme.scroll(wrap),BorderLayout.CENTER);
        JButton register=Theme.button("＋ 상품 등록",()->app.showRegister(mode.equals("교환")?"교환":"대여",()->app.showList(mode,search.getText())));
        JPanel bottom=new JPanel();bottom.setBackground(Theme.WHITE);bottom.setBorder(new EmptyBorder(8,16,12,16));register.setPreferredSize(new Dimension(0,46));bottom.setLayout(new BorderLayout());bottom.add(register);add(bottom,BorderLayout.SOUTH);
        search.addActionListener(e->refresh());category.addActionListener(e->refresh());favorites.addActionListener(e->refresh());refresh();
    }
    private void refresh(){
        results.removeAll();var list=app.items.search(search.getText(),(String)category.getSelectedItem(),mode,favorites.isSelected());count.setText("전체 "+list.size());
        if(list.isEmpty())results.add(Theme.label("검색 결과가 없어요.",13,false,Theme.MUTED));
        for(Item it:list){results.add(new ItemCard(app,it,()->app.showDetail(it.id,()->app.showList(mode,search.getText()))));results.add(Box.createVerticalStrut(10));}
        results.revalidate();results.repaint();
    }
}
