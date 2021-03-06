#include "abdrive360.h"
#include "ping.h"
#include "simpletools.h"
#include "xbee.h"
#include "melody.h"

enum {
    BUFFER_SIZE = 200,
    XBEE_DO_PIN = 4,
    XBEE_DI_PIN = 3,
    WHISKERS_LEFT_PIN = 8,
    WHISKERS_RIGHT_PIN = 9,
    PIEZO_SPEAKER_PIN = 2,
    PING_SENSOR_PIN = 6,
    BUTTON_PIN = 7,
    LED_0_PIN = 26,
    LED_1_PIN = 27,
    INFRA_LIGHT_PIN = 5,
    INFRA_LEFT_PIN = 11,
    INFRA_RIGHT_PIN = 10,
    PRESSED = 0,
    LONG_HOLD_DURATION = 3000,
};

fdserial* xbee;
unsigned char buffer[BUFFER_SIZE];
char response[10];
int buffer_len;

unsigned char mac_addr[6];
unsigned char ip4_addr[4];
unsigned char ip4_port[2];

static const unsigned char server_addr[4] = { 52, 73, 65, 98 }; // netsblox.org
//static const unsigned char server_addr[4] = { 129, 59, 104, 208 }; // mmaroti.isis.vanderbilt.edu
static const unsigned char server_port[2] = { 0x07, 0xb5 }; // 1973

unsigned int time_ref = 0;
unsigned int last_cnt = 0;
int comSeqNum = 0;


// to keep track of time for user button
unsigned int buttonState;     // current state of the button
unsigned int lastButtonState = 1; // previous state of the button
unsigned int startPressed = 0;    // the time button was pressed
unsigned int endPressed = 0;      // the time button was released
unsigned int timeHold = 0;        // the time button is hold
unsigned int timeReleased = 0;    // the time button is released


int get_time()
{
    unsigned int elapsed = CNT - last_cnt;
    while (elapsed >= CLKFREQ) {
        elapsed -= CLKFREQ;
        last_cnt += CLKFREQ;
        time_ref += 1000;
    }
    return time_ref + elapsed / (CLKFREQ / 1000);
}

unsigned short ntohs(unsigned char* data)
{
    return (data[0] << 8) + data[1];
}

void buffer_print(int len)
{
    print("buffer %d:", len);
    if (len > BUFFER_SIZE)
        len = BUFFER_SIZE;
    for (int i = 0; i < len; i++)
        print(" %02x", buffer[i]);
    print("\n");
}

int cmp_api_response(int len, const unsigned char* prefix)
{
    if (buffer_len != len)
        return 0;
    for (int i = 0; i < 5; i++) {
        if (prefix[i] != buffer[i])
            return 0;
    }
    return 1;
}

int cmp_rx_headers(int len, unsigned char cmd)
{
    return buffer_len == len && buffer[0] == 0xb0 && buffer[11] == cmd;
}

void set_tx_headers(unsigned char cmd)
{
    int time = get_time();
    buffer[0] = 0x20;
    buffer[1] = 0x10;
    memcpy(buffer + 2, server_addr, 4);
    memcpy(buffer + 6, server_port, 2);
    memcpy(buffer + 8, ip4_port, 2);
    buffer[10] = 0x00;
    buffer[11] = 0x00;
    memcpy(buffer + 12, mac_addr, 6);
    memcpy(buffer + 18, &time, 4);
    buffer[22] = cmd;
    buffer_len = 23;
}

void write_le16(short data)
{
    memcpy(buffer + buffer_len, &data, 2);
    buffer_len += 2;
}

void write_le32(int data)
{
    memcpy(buffer + buffer_len, &data, 4);
    buffer_len += 4;
}

// display incoming xbee msg
void display_incoming()
{
    buffer_len = xbee_recv_api(xbee, buffer, BUFFER_SIZE, 10);
    if (buffer_len > 0) {
        print("resp: ");
        buffer_print(buffer_len);
    }
}

// used for configuration stage
// sync communication with xbee module
void com_sync(const char* cmd, int len, char* comment)
{
    comSeqNum++;
    char frame [len + 2];
    frame[0] = 8; // frame type
    frame[1] = comSeqNum; // add request number
    for(int i=2;i<len+2;i++) { // append the cmd
        frame[i] = cmd[i-2];
    }
    print("#### %s ####\n", comment);
    /* print("sending: %s \n", cmd); */
    xbee_send_api(xbee, frame, len + 2);
    pause(100);
    display_incoming();
    print("==========\n");
}

int xbcmd(char *cmd, char *reply, int bytesMax, int msMax)
{
    int c = -1, n = 0;
    writeStr(xbee, cmd);
    memset(reply, 0, bytesMax);

    int tmax = (CLKFREQ/1000) * msMax;
    int tmark = CNT;

    while(1)
    {
        c = fdserial_rxCheck(xbee);
        if(c != -1)
            reply[n++] = c;
        if(CNT - tmark > tmax)
            return 0;
        if(c == '\r')
            return n;
    }
}

void software_reset_xbee()
{
    print("software resetting the xbee module\n");
    pause(1000);
    xbee_send_api(xbee, "\8\000FR", 4);
    display_incoming();
    pause(5000);
    print("finished resetting xbee\n");
}

void setup_mode()
{
    play_music1();
    /* software_reset_xbee(); */
    print("cmd = +++\n");
    int bytes = xbcmd("+++", response, 10, 2000);
    if(bytes == 0)
        print("Timeout error.\n");
    else
    {
        print("reply = %s", response);

        print("\n##### entering setup mode #####\n");
        print("\n##### network reset xbee #####\n");
        xbcmd("ATNR\r", response, 10, 20);
        print("reply = %s", response);
        pause(500);
    }
}

int main()
{
    input(XBEE_DO_PIN);
    xbee = xbee_open(XBEE_DO_PIN, XBEE_DI_PIN, 1);
    pause(500);

    // TODO if failed to connect to an AP, enter setup mode

    xbee_send_api(xbee, "\x8\001SL", 4);
    xbee_send_api(xbee, "\x8\002SH", 4);
    xbee_send_api(xbee, "\x8\003C0", 4);
    xbee_send_api(xbee, "\x8\004MY", 4);
    pause(500);
    xbee_send_api(xbee, "\x8\005AI", 4);
    
    int whiskers = 0;
    int button = 0;
    int infrared = 0;

    int slower = 0;
    while (1) {
        int temp;
        buffer_len = xbee_recv_api(xbee, buffer, BUFFER_SIZE, 10);

        if (buffer_len == -1) {
            if (++slower >= 100) { // alive
                slower = 0;
                xbee_send_api(xbee, "\x8\004MY", 4);
                set_tx_headers('I');
                xbee_send_api(xbee, buffer, buffer_len);
            }
        } else if (cmp_api_response(6, "\x88\005AI")) {
            
            // SSID not configured, likely new or incorrectly reset module
            if(buffer[5] == 0x23){
                print("restoring default settings...\n");
                xbee_send_api(xbee, "\x8\000NR", 4);
                pause(500);
                // Set to default wifi AP
                xbee_send_api(xbee, "\x8\000IDrobonet", 11);  
                xbee_send_api(xbee, "\x8\000EE\002", 5);
                xbee_send_api(xbee, "\x8\000PKcybercamp", 13);
                xbee_send_api(xbee, "\x8\000WR", 4);
                pause(1000);
                // Reset module
                xbee_send_api(xbee, "\x8\000FR", 4);
                pause(1000); 
                // Update values
                xbee_send_api(xbee, "\x8\003C0", 4);
                xbee_send_api(xbee, "\x8\004MY", 4);
            }              
                
        } else if (cmp_api_response(9, "\x88\001SL")) {
            memcpy(mac_addr + 2, buffer + 5, 4);
        } else if (cmp_api_response(7, "\x88\002SH")) {
            memcpy(mac_addr, buffer + 5, 2);
            print("mac:");
            for (int i = 0; i < 6; i++)
                print(" %02x", mac_addr[i]);
            print("\n");
        } else if (cmp_api_response(7, "\x88\003C0")) {
            memcpy(ip4_port, buffer + 5, 2);
        } else if (cmp_api_response(9, "\x88\004MY")) {
            memcpy(ip4_addr, buffer + 5, 4);
            print("ip4:");
            for (int i = 0; i < 4; i++)
                print("%c%d", i == 0 ? ' ' : '.', ip4_addr[i]);
            print(" %d\n", ntohs(ip4_port));
        } else if (cmp_rx_headers(16, 'B')) { // beep
            int msec = *(short*)(buffer + 12);
            int tone = *(short*)(buffer + 14);
            freqout(PIEZO_SPEAKER_PIN, msec, tone);
            set_tx_headers('B');
            write_le16(msec);
            write_le16(tone);
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (cmp_rx_headers(15, 'G')) { // infra light
            int msec = *(short*)(buffer + 12);
            int pwr = *(buffer + 14);
            int old = get_output(26);
            dac_ctr(26, 0, pwr);
            freqout(INFRA_LIGHT_PIN, msec, 38000);
            dac_ctr_stop();
            set_output(26, old);
            set_tx_headers('G');
            write_le16(msec);
            buffer[buffer_len++] = pwr;
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (cmp_rx_headers(16, 'S')) { // setSpeed
            int left = *(short*)(buffer + 12);
            int right = *(short*)(buffer + 14);
            drive_speed(left, right);
            set_tx_headers('S');
            write_le16(left);
            write_le16(right);
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (cmp_rx_headers(12, 'R')) { // getRange
            int dist = ping_cm(PING_SENSOR_PIN);
            set_tx_headers('R');
            write_le16(dist);
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (cmp_rx_headers(12, 'T')) { // getTicks
            int left, right;
            drive_getTicks(&left, &right);
            set_tx_headers('T');
            write_le32(left);
            write_le32(-right); // this seems to be inverted
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (cmp_rx_headers(16, 'D')) { // drive
            int left = *(short*)(buffer + 12);
            int right = *(short*)(buffer + 14);
            set_tx_headers('D');
            write_le16(left);
            write_le16(right);
            xbee_send_api(xbee, buffer, buffer_len);
            drive_goto(left, right);
        } else if (cmp_rx_headers(14, 'L')) { // setLed
            int led = *(buffer + 12);
            int state = *(buffer + 13);
            set_tx_headers('L');
            buffer[buffer_len++] = led;
            buffer[buffer_len++] = state;
            if (led == 0)
                led = LED_0_PIN;
            else
                led = LED_1_PIN;
            if (state == 0)
                low(led);
            else if (state == 1)
                high(led);
            else
                toggle(led);
            xbee_send_api(xbee, buffer, buffer_len);
        } else if (buffer_len >= 0) { // unknown
            buffer_print(buffer_len);
        }

        temp = (input(WHISKERS_LEFT_PIN) << 1) | input(WHISKERS_RIGHT_PIN);
        if (whiskers != temp) { // whiskers
            whiskers = temp;
            set_tx_headers('W');
            buffer[buffer_len++] = whiskers;
            xbee_send_api(xbee, buffer, buffer_len);
        }
        buttonState = input(BUTTON_PIN);
        if (button != buttonState) { // user button
            button = buttonState;
            set_tx_headers('P');
            buffer[buffer_len++] = button;
            xbee_send_api(xbee, buffer, buffer_len);
        }
        temp = (input(INFRA_LEFT_PIN) << 1) | input(INFRA_RIGHT_PIN);
        if (infrared != temp) { // infra red
            infrared = temp;
            set_tx_headers('F');
            buffer[buffer_len++] = infrared;
            xbee_send_api(xbee, buffer, buffer_len);
        }

        /* button state detection */
        if (buttonState != lastButtonState) { // button state changed
            lastButtonState = buttonState;

            // the button was just pressed
            if (buttonState == PRESSED) {
                startPressed = get_time();
                timeReleased = startPressed - endPressed;
                // here we can compute for button idle time

            } else { // the button was just released
                endPressed = get_time();
                timeHold = endPressed - startPressed;

                if (timeHold >= LONG_HOLD_DURATION) {
                    print("entering setup mode\n");
                    setup_mode();
                }

            }
        } /* end of button state detection */

    }
}
