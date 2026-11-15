package kr.ac.sharemate.ui;

import javax.swing.*;
import javax.swing.border.EmptyBorder;
import java.awt.*;
import java.io.File;

public class RegisterPanel extends JPanel {
    private File image;
    public RegisterPanel(MainFrame app,String initialMode,Runnable back){
        super(new BorderLayout());setBackground(Theme.WHITE);add(Theme.header("상품 등록",back),BorderLayout.NORTH);
        JPanel form=Theme.paddedColumn(8,20,18,20);
        JLabel photoLabel=Theme.label("선택된 사진이 없습니다.",12,false,Theme.MUTED);
        JButton choose=Theme.ghost("＋ 사진 선택",()->{JFileChooser fc=new JFileChooser();fc.setFileFilter(new javax.swing.filechooser.FileNameExtensionFilter("이미지 파일","jpg","jpeg","png","gif"));if(fc.showOpenDialog(app)==JFileChooser.APPROVE_OPTION){image=fc.getSelectedFile();photoLabel.setText(image.getName());}});
        form.add(Theme.label("상품 사진",14,true,Theme.TEXT));form.add(choose);form.add(photoLabel);form.add(Box.createVerticalStrut(12));
        JTextField title=new JTextField(),deposit=new JTextField(),price=new JTextField(),want=new JTextField(),tags=new JTextField();
        JComboBox<String> category=new JComboBox<>(Theme.CATEGORIES);JTextArea desc=new JTextArea(5,20);desc.setLineWrap(true);desc.setWrapStyleWord(true);
        JRadioButton rent=new JRadioButton("대여",true),exchange=new JRadioButton("물물교환");ButtonGroup group=new ButtonGroup();group.add(rent);group.add(exchange);
        if("교환".equals(initialMode)){exchange.setSelected(true);rent.setSelected(false);}
        JPanel mode=new JPanel(new FlowLayout(FlowLayout.LEFT));mode.setOpaque(false);mode.add(rent);mode.add(exchange);
        form.add(field("상품 이름",title));form.add(field("카테고리",category));form.add(field("거래 방식",mode));
        JPanel rentFields=new JPanel(new GridLayout(1,2,8,0));rentFields.setOpaque(false);rentFields.add(field("보증금 (원)",deposit));rentFields.add(field("대여비 (원)",price));
        JPanel exFields=new JPanel(new GridLayout(1,2,8,0));exFields.setOpaque(false);exFields.add(field("희망 물품",want));exFields.add(field("해시태그",tags));
        JPanel dynamic=new JPanel(new CardLayout());dynamic.setOpaque(false);dynamic.add(rentFields,"rent");dynamic.add(exFields,"exchange");CardLayout cards=(CardLayout)dynamic.getLayout();
        rent.addActionListener(e->cards.show(dynamic,"rent"));exchange.addActionListener(e->cards.show(dynamic,"exchange"));cards.show(dynamic,rent.isSelected()?"rent":"exchange");
        form.add(dynamic);form.add(field("상품 설명",new JScrollPane(desc)));form.add(Theme.label("거래 동네  대전광역시 유성구 온천2동",12,false,Theme.MUTED));
        add(Theme.scroll(form),BorderLayout.CENTER);
        JButton submit=Theme.button("등록하기",()->{
            String t=title.getText().trim();if(t.isEmpty()){warn(app,"상품 이름을 입력해 주세요.");return;}
            boolean isRent=rent.isSelected();int fee=0,dep=0;
            try{if(isRent){fee=number(price.getText());dep=number(deposit.getText());}else if(want.getText().trim().isEmpty()){warn(app,"희망 물품을 입력해 주세요.");return;}}
            catch(NumberFormatException ex){warn(app,"금액은 0 이상의 숫자로 입력해 주세요.");return;}
            app.items.create(isRent,t,(String)category.getSelectedItem(),desc.getText().trim(),want.getText().trim(),tags.getText().trim(),image==null?null:image.getAbsolutePath(),fee,dep);
            JOptionPane.showMessageDialog(app,"상품이 등록되었습니다.");app.showList(isRent?"대여":"교환","");
        });
        JPanel bottom=new JPanel(new BorderLayout());bottom.setBackground(Theme.WHITE);bottom.setBorder(new EmptyBorder(10,18,12,18));bottom.add(submit);add(bottom,BorderLayout.SOUTH);
    }
    private JPanel field(String name,JComponent input){JPanel p=new JPanel(new BorderLayout(0,5));p.setOpaque(false);p.setBorder(new EmptyBorder(5,0,8,0));p.add(Theme.label(name,13,true,Theme.TEXT),BorderLayout.NORTH);input.setFont(new Font("Malgun Gothic",Font.PLAIN,13));p.add(input);return p;}
    private int number(String s){if(s.isBlank())return 0;int n=Integer.parseInt(s.replace(",","").trim());if(n<0)throw new NumberFormatException();return n;}
    private void warn(JFrame f,String s){JOptionPane.showMessageDialog(f,s,"확인",JOptionPane.WARNING_MESSAGE);}
}
