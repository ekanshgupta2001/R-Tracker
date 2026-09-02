package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.pedropathing.follower.Follower;

@Autonomous(name = "NotCommandBased")
public class NotCommandBased extends LinearOpMode {
    Follower follower;
    int step = 0;

    @Override
    public void runOpMode() {
        follower = new Follower(hardwareMap);
        waitForStart();
        while (opModeIsActive()) {
            follower.update();
            if (step == 0 && !follower.isBusy()) step = 1;
            if (step == 1) { sleep(2000); step = 2; }
        }
    }
}
