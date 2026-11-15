package kr.ac.sharemate;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import kr.ac.sharemate.ui.MainFrame;

public class Main {
    public static void main(String[] args) {
        try { UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName()); }
        catch (Exception ignored) {}
        SwingUtilities.invokeLater(() -> new MainFrame().setVisible(true));
    }
}
