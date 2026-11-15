package kr.ac.sharemate.ui;

import javax.swing.*;
import javax.swing.border.*;
import java.awt.*;

public final class Theme {
    public static final Color BLUE=new Color(35,105,235), BLUE_DARK=new Color(24,82,194),
        BG=new Color(246,248,251), WHITE=Color.WHITE, TEXT=new Color(31,41,55),
        MUTED=new Color(135,145,158), LINE=new Color(230,234,240), PALE_BLUE=new Color(235,243,255),
        PALE_YELLOW=new Color(255,249,230);
    public static final String[] CATEGORIES={"책/전공","음식/유제품","음식/육류","전자기기","의류/잡화","생활/가전","기타"};
    private Theme(){}
    public static JLabel label(String text,int size,boolean bold,Color color){
        JLabel l=new JLabel(text);l.setFont(new Font("Malgun Gothic",bold?Font.BOLD:Font.PLAIN,size));l.setForeground(color);return l;
    }
    public static JButton button(String text,Runnable action){
        JButton b=new JButton(text);b.setFont(new Font("Malgun Gothic",Font.BOLD,14));b.setForeground(Color.WHITE);
        b.setBackground(BLUE);b.setFocusPainted(false);b.setBorder(new EmptyBorder(11,18,11,18));b.setCursor(Cursor.getPredefinedCursor(Cursor.HAND_CURSOR));
        b.addActionListener(e->{if(action!=null)action.run();});return b;
    }
    public static JButton ghost(String text,Runnable action){
        JButton b=new JButton(text);b.setFont(new Font("Malgun Gothic",Font.PLAIN,13));b.setForeground(TEXT);b.setBackground(WHITE);
        b.setFocusPainted(false);b.setBorder(new CompoundBorder(new LineBorder(LINE),new EmptyBorder(8,12,8,12)));
        b.addActionListener(e->{if(action!=null)action.run();});return b;
    }
    public static JPanel column(){JPanel p=new JPanel();p.setLayout(new BoxLayout(p,BoxLayout.Y_AXIS));p.setBackground(WHITE);return p;}
    public static JPanel page(){JPanel p=new JPanel(new BorderLayout());p.setBackground(WHITE);return p;}
    public static JPanel header(String title,Runnable back){
        JPanel p=new JPanel(new BorderLayout());p.setBackground(WHITE);p.setBorder(new EmptyBorder(12,14,12,14));
        JButton b=ghost("‹",back);b.setFont(new Font("Dialog",Font.BOLD,24));p.add(b,BorderLayout.WEST);
        p.add(label(title,17,true,TEXT),BorderLayout.CENTER);return p;
    }
    public static JScrollPane scroll(JComponent c){JScrollPane s=new JScrollPane(c);s.setBorder(null);s.getVerticalScrollBar().setUnitIncrement(16);return s;}
    public static JPanel paddedColumn(int top,int left,int bottom,int right){
        JPanel p=column();p.setBorder(new EmptyBorder(top,left,bottom,right));return p;
    }
}
