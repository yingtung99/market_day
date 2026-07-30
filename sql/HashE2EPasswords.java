import com.example.demo.Service.BCrypt;

public final class HashE2EPasswords {
    private HashE2EPasswords() {}

    public static void main(String[] args) {
        if (args.length != 3) {
            throw new IllegalArgumentException("Expected vendor, organizer and admin passwords");
        }
        for (String password : args) {
            System.out.println(BCrypt.hashpw(password, BCrypt.gensalt()));
        }
    }
}
