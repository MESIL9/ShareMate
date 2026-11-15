package kr.ac.sharemate.ui;

import kr.ac.sharemate.model.Item;
import javax.swing.*;
import java.awt.*;

public class MyPagePanel extends JPanel {
    public MyPagePanel(MainFrame app){
        super(new BorderLayout());setBackground(Theme.WHITE);JPanel p=Theme.paddedColumn(18,16,18,16);
        p.add(Theme.label("마이페이지",23,true,Theme.TEXT));p.add(Box.createVerticalStrut(18));
        p.add(Theme.label("♥ 찜한 상품",16,true,Theme.BLUE));p.add(Box.createVerticalStrut(8));
        var favorites=app.items.search("","전체 카테고리","전체",true);
        if(favorites.isEmpty())p.add(Theme.label("찜한 상품이 없어요.",12,false,Theme.MUTED));
        for(Item it:favorites){p.add(new ItemCard(app,it,()->app.showDetail(it.id,app::showMy)));p.add(Box.createVerticalStrut(8));}
        p.add(Box.createVerticalStrut(18));p.add(Theme.label("📦 내가 등록한 상품",16,true,Theme.BLUE));p.add(Box.createVerticalStrut(8));
        var mine=app.items.myItems();if(mine.isEmpty())p.add(Theme.label("등록한 상품이 없어요.",12,false,Theme.MUTED));
        for(Item it:mine){p.add(new ItemCard(app,it,()->app.showDetail(it.id,app::showMy)));p.add(Box.createVerticalStrut(8));}
        add(Theme.scroll(p),BorderLayout.CENTER);
    }
}
