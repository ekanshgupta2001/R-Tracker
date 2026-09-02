package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.ColorSensor;
import com.qualcomm.robotcore.hardware.DistanceSensor;
import com.qualcomm.robotcore.util.ElapsedTime;
import org.firstinspires.ftc.robotcore.external.navigation.DistanceUnit;

@Autonomous(name = "SensorAuto")
public class SensorAuto extends LinearOpMode {
    // Each step of the routine is a named state; transitions happen only in the switch
    enum State { DRIVE_TO_LINE, CHECK_COLOR, SCORE, PARK, DONE }

    private State state = State.DRIVE_TO_LINE;
    private ColorSensor colorSensor;
    private DistanceSensor distance;
    private final ElapsedTime timer = new ElapsedTime();

    @Override
    public void runOpMode() {
        Robot robot = new Robot(hardwareMap);
        colorSensor = hardwareMap.get(ColorSensor.class, "color");
        distance = hardwareMap.get(DistanceSensor.class, "distance");
        waitForStart();
        timer.reset();

        while (opModeIsActive() && state != State.DONE) {
            // Average five readings so one noisy spike cannot trigger a transition
            double sum = 0;
            for (int i = 0; i < 5; i++) sum += distance.getDistance(DistanceUnit.CM);
            double cm = sum / 5.0;

            switch (state) {
                case DRIVE_TO_LINE:
                    robot.drivetrain.drive(0.4, 0);
                    if (cm < 20) { state = State.CHECK_COLOR; timer.reset(); }
                    break;
                case CHECK_COLOR:
                    robot.drivetrain.stop();
                    // Red elements read high on the red channel relative to blue
                    if (colorSensor.red() > colorSensor.blue() + 40) {
                        state = State.SCORE;
                    } else if (timer.seconds() > 2.0) {
                        state = State.PARK;
                    }
                    break;
                case SCORE:
                    robot.intake.run(1.0);
                    if (timer.seconds() > 3.5) { robot.intake.run(0); state = State.PARK; }
                    break;
                case PARK:
                    robot.drivetrain.drive(-0.3, 0);
                    if (timer.seconds() > 5.0) { robot.drivetrain.stop(); state = State.DONE; }
                    break;
            }
            telemetry.addData("State", state);
            telemetry.addData("Distance cm", cm);
            telemetry.addData("Red", colorSensor.red());
            telemetry.update();
        }
        robot.drivetrain.stop();
    }
}
