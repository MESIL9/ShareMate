package kr.ac.sharemate.ui;

import kr.ac.sharemate.db.Database;
import kr.ac.sharemate.service.*;
import kr.ac.sharemate.model.Item;
import javax.swing.*;
import java.awt.*;

public class MainFrame extends JFrame {
    public final ItemService items=new ItemService();
    public final ChatService chats=new ChatService();
    private final JPanel content=new JPanel(new BorderLayout());
    private final JPanel navigation=new JPanel(new GridLayout(1,3));
    public MainFrame(){
        super("쉐어메이트");Database.initialize();
        setDefaultCloseOperation(EXIT_ON_CLOSE);setSize(430,850);setMinimumSize(new Dimension(390,700));setLocationRelativeTo(null);
        content.setBackground(Theme.WHITE);add(content,BorderLayout.CENTER);buildNavigation();showHome();
    }
    private void buildNavigation(){
        navigation.setBackground(Theme.WHITE);navigation.setBorder(BorderFactory.createMatteBorder(1,0,0,0,Theme.LINE));
        String[] names={"채팅","홈","마이"};Runnable[] actions={this::showChats,this::showHome,this::showMy};
        for(int i=0;i<3;i++){JButton b=Theme.ghost(names[i],actions[i]);b.setBorderPainted(false);navigation.add(b);}
        add(navigation,BorderLayout.SOUTH);
    }
    public void show(JComponent panel,boolean nav){content.removeAll();content.add(panel);navigation.setVisible(nav);content.revalidate();content.repaint();}
    public void showHome(){show(new HomePanel(this),true);}
    public void showList(String mode,String query){show(new ItemListPanel(this,mode,query),true);}
    public void showDetail(int id,Runnable back){Item it=items.get(id);if(it!=null){items.incrementViews(id);show(new ItemDetailPanel(this,items.get(id),back),false);}}
    public void showRegister(String mode,Runnable back){show(new RegisterPanel(this,mode,back),false);}
    public void showChat(int id,Runnable back){show(new ChatPanel(this,id,back),false);}
    public void showChats(){show(new ChatListPanel(this),true);}
    public void showMy(){show(new MyPagePanel(this),true);}
}
